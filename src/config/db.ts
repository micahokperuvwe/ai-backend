import mongoose from 'mongoose';

export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || '');
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        mongoose.connection.on('connected', () => console.log('Mongoose connected to DB Cluster'));
        mongoose.connection.on('error', (err) => console.error('Mongoose connection error:', err));
        mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
};
