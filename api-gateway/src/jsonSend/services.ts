import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { VoyageEmbeddings } from "@langchain/community/embeddings/voyage";
import { v4 as uuidv4 } from "uuid";
import Redis from "ioredis";
import { IScene } from "../public.interface";
import Scene from "../public.model";
import { anthropic } from "../claude";
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from "dotenv";

dotenv.config();

class RedisManager {
    private redis: Redis;
    private static KEY_EXPIRATION = 3600;
    private static REDIS_CHANNEL = "manim_code_notifications";

    constructor(redisUri: string, redisHost: string, redisPort: number ,redisPass: string) {
        this.redis = new Redis(redisUri, {
            host: redisHost,
            port: redisPort,
            password: redisPass,
            tls: {},  // SSL enabled
            connectTimeout: 20000, // Increase timeout to 20 seconds
            retryStrategy: (times: number) => {
                if (times > 3) {
                    console.error('Redis connection failed after 3 attempts');
                    return null;
                }
                return Math.min(times * 200, 3000);
            }
        });

        this.redis.on('connect', () => console.log('Successfully connected to Azure Cache for Redis'));
        this.redis.on('error', (err) => {
            console.error('Redis connection error:', err);
        });
    }

    async saveAndPublish(topic: string, manimCode: string): Promise<string> {
        const sessionId = uuidv4();
        const redisKey = `manim:${sessionId}`;
        const redisValue = JSON.stringify({
            topic,
            manimCode,
            audioUrl: "",
            videoUrl: "",
            status: "generated",
            createdAt: new Date().toISOString()
        });
        await this.redis.set(redisKey, redisValue, 'EX', RedisManager.KEY_EXPIRATION)
        console.log(`Saved to Redis with key: ${redisKey}`);

        const message = JSON.stringify({ sessionId, status: "ready_to_run" });
        await this.redis.publish(RedisManager.REDIS_CHANNEL, message);
        console.log(`Published to Redis channel: ${RedisManager.REDIS_CHANNEL}`);

        return sessionId;
    }
    async quit(): Promise<void> {
        await this.redis.quit();
    }
}   

class GitHubLoader {
    private repos: string[]
    private authToken: string;
    private voyageAPI: string;

    constructor(repos: string[], authToken: string, voyageAPI: string) {
        this.repos = repos;
        this.authToken = authToken;
        this.voyageAPI = voyageAPI;
    }
    async setupRetriever(): Promise<any> {
        const documents = [];
        for (const repo of this.repos) {
            const loader = new GithubRepoLoader("https://github.com/Aspandiyar933/videos", { accessToken: this.authToken, branch: "master" });
            const repoDocuments = await loader.load();
            documents.push(...repoDocuments);
        }
        const textSplitter = new CharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 0,
        });
        const texts = await textSplitter.splitDocuments(documents);

        const embeddings = new VoyageEmbeddings({apiKey: this.voyageAPI});
        const dbConfig = {
            collectionName: "manim_docs",
            url: this.voyageAPI, // Make sure to set this in your environment variables
            collectionMetadata: {
                "hnsw:space": "cosine",
            },
        };
        const vectorStore = await Chroma.fromDocuments(texts, embeddings, dbConfig);
        return vectorStore.asRetriever();
    }
}


class ManimCodeGenerator {
    private llm: Anthropic;
    
    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("Anthropic API key is not provided");
        }
        this.llm = new Anthropic({ apiKey });
    }


    private extractTextFromContent(content: Anthropic.Messages.ContentBlock[]): string {
        return content
            .filter((block): block is Anthropic.TextBlock => block.type === 'text')
            .map(block => block.text)
            .join('\n');
    }

    //should add retriever: any,
    async generateCode(topic: string): Promise<string> {
        // Create a prompt for best practices
        const bestPracticesPrompt = `What are the best practices for creating Manim animations to explain ${topic}?`;

        // Get best practices
        const bestPracticesResponse = await this.llm.messages.create({
            model: "claude-3-opus-20240229",
            max_tokens: 1000,
            messages: [{ role: "user", content: bestPracticesPrompt }]
        });
        const bestPractices = this.extractTextFromContent(bestPracticesResponse.content);

        // Create a prompt for Manim code generation
        const manimPrompt = `Generate Manim code to visualize the following math concept: ${topic}\n\n` +
                            `Incorporate these best practices:\n${bestPractices}\n\nManim code:`;

        // Generate Manim code
        const manimCodeResponse = await this.llm.messages.create({
            model: "claude-3-opus-20240229",
            max_tokens: 2000,
            messages: [{ role: "user", content: manimPrompt }]
        });
        const manimCode = this.extractTextFromContent(manimCodeResponse.content);

        return manimCode;
    }
}

export default class ManimService {
    private redisManager: RedisManager;
    //private gitHubLoader: GitHubLoader;
    private manimCodeGenerator: ManimCodeGenerator;

    constructor(redisUri:string, repos: string[], authToken: string, voyageAPI: string, anthropicApiKey:string, redisHost: string, redisPort: number ,redisPass: string) {
        this.redisManager = new RedisManager(redisUri, redisHost, redisPort, redisPass);
        //this.gitHubLoader = new GitHubLoader(repos, authToken, voyageAPI);
        this.manimCodeGenerator = new ManimCodeGenerator(anthropicApiKey);
    }

    async generateAndSaveManimCode(topic: string): Promise<{ session_id: string, status: string }> {
        // const retriever = await this.gitHubLoader.setupRetriever();
        const manimCode = await this.manimCodeGenerator.generateCode(topic);
        const sessionId = await this.redisManager.saveAndPublish(topic, manimCode);

        const newScene: IScene = {
            topic,
            manimCode,
            audioUrl: "",
            videoUrl: '"',
            status: "generated",
            createdAt: new Date().toISOString()
        };
        await Scene.create(newScene);

        return {
            session_id: sessionId,
            status: "generated_and_notified"
        };
    }

    async close(): Promise<void> {
        await this.redisManager.quit();
    }
}
