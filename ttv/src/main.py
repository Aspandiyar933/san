import os
import json
import glob
import uuid
import redis
import logging
import tempfile
import subprocess
from pydantic import BaseModel
from fastapi import FastAPI, BackgroundTasks
from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceExistsError

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()

AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_CONTAINER_NAME = os.getenv("AZURE_STORAGE_CONTAINER_NAME")

REDIS_URI = os.getenv("REDIS_URI", "")
REDIS_CHANNEL = os.getenv("REDIS_CHANNEL", "manim_code_notifications")

if not all([REDIS_URI, REDIS_CHANNEL,AZURE_STORAGE_CONNECTION_STRING, AZURE_CONTAINER_NAME]):
    raise ValueError("Missing required environment variables")

redis_client = redis.Redis.from_url(REDIS_URI)

try:
    blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
    container_client = blob_service_client.get_container_client(AZURE_CONTAINER_NAME)
    container_client.get_container_properties()
except Exception as e:
    logger.error(f"Error connecting to Azure Blob Storage: {str(e)}")
    raise

class Message(BaseModel):
    sessionId: str
    status: str

class FromRedis(BaseModel):
    topic: str
    manimCode: str
    audioUrl: str
    videoUrl: str
    status: str
    createdAt: str

class ManimExecutionError(Exception):
    pass

def run_manim_code(code: str) -> str:
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
        temp_file.write(code)
        temp_file_path = temp_file.name
        print(temp_file_path)
    try:
        command = ['manim', '-pql', temp_file_path, 'ManimScene']
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        
        output_dir = os.path.dirname('ManimScene')
        video_files = glob.glob(os.path.join(output_dir, "**", "*.mp4"), recursive=True)
        print(video_files)
        if not video_files:
            raise ManimExecutionError(f"No video file was generated. Manim output: {result.stdout}")
        
        return video_files[0]

    except subprocess.CalledProcessError as e:
        logger.error(f"Error running Manim: {e.output}")
        raise ManimExecutionError(f"Error running Manim code: {e.output}")
    except Exception as e:
        logger.error(f"Unexpected error in run_manim_code: {str(e)}")
        raise ManimExecutionError(f"Unexpected error: {str(e)}")
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

def upload_to_azure_storage(file_path: str) -> str:
    file_name = os.path.basename(file_path)
    unique_file_name = f"{uuid.uuid4()}_{file_name}"
    blob_client = container_client.get_blob_client(unique_file_name)
    
    try:
        with open(file_path, "rb") as data:
            blob_client.upload_blob(data, overwrite=True)
        logger.info(f"File {unique_file_name} uploaded to Azure Blob Storage")
        return blob_client.url
    except ResourceExistsError:
        logger.warning(f"Blob {unique_file_name} already exists. Overwriting...")
        with open(file_path, "rb") as data:
            blob_client.upload_blob(data, overwrite=True)
        logger.info(f"File {unique_file_name} overwritten in Azure Blob Storage")
        return blob_client.url
    except Exception as e:
        logger.error(f"Error uploading to Azure Storage: {str(e)}")
        raise

def process_manim_code(message: Message):
    try:
        # Retrieve Manim code from Redis
        redis_key = f"manim:{message.sessionId}"
        redis_value = redis_client.get(redis_key)
        if not redis_value:
            logger.error(f"No data found for session {message.sessionId}")
            return

        data = FromRedis.parse_raw(redis_value)
        if not data.manimCode:
            logger.error(f"No Manim code found for session {message.sessionId}")
            return

        # Run Manim code
        video_path = run_manim_code(data.manimCode)

        # Upload video to Azure Blob Storage
        video_url = upload_to_azure_storage(video_path)

        # Update Redis with video URL and status
        data.videoUrl = video_url
        data.status = 'completed'
        redis_client.set(redis_key, data.json())

        # Publish completion message
        redis_client.publish(REDIS_CHANNEL, Message(sessionId=message.sessionId, status="completed").json())

        logger.info(f"Processing completed for session {message.sessionId}")
    except Exception as e:
        logger.error(f"Error processing Manim code for session {message.sessionId}: {str(e)}")
        # Update Redis with error status
        data = FromRedis.parse_raw(redis_client.get(f"manim:{message.sessionId}") or '{}')
        data.status = 'error'
        redis_client.set(f"manim:{message.sessionId}", data.json())
        # Publish error message
        redis_client.publish(REDIS_CHANNEL, Message(sessionId=message.sessionId, status="error").json())

@app.post("/process")
async def process_message(message: Message, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_manim_code, message)
    return {"status": "Processing started"}

def start_redis_listener():
    pubsub = redis_client.pubsub()
    pubsub.subscribe(REDIS_CHANNEL)
    logger.info(f"Listening to Redis channel: {REDIS_CHANNEL}")
    for message in pubsub.listen():
        if message['type'] == 'message':
            data = json.loads(message['data'])
            process_manim_code(Message(**data))

if __name__ == "__main__":
    import uvicorn
    from threading import Thread

    # Start Redis listener in a separate thread
    redis_thread = Thread(target=start_redis_listener, daemon=True)
    redis_thread.start()

    uvicorn.run(app, host="0.0.0.0", port=8000)