import mongoose, {ConnectOptions} from "mongoose";

class Database {
    private readonly URI: string;
    static connect: any;

    constructor() {
        this.URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mal';
        this.connect();
    }

    public async connect() {
        try {
            const options: ConnectOptions = {
                serverSelectionTimeoutMS: 30000, // 30 seconds
                socketTimeoutMS: 45000 // 45 seconds
            };
            await mongoose.connect(this.URI, options);
            console.log("Database connected successfully");
        } catch (error) {
            console.error("Database connection failed");
        }
    }
}

export default Database;