import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import User from './models/User';

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || '');
        console.log(`Connected to ${mongoose.connection.host} for seeding...`);

        // Check if exists
        const exists = await User.findOne({ email: 'mic@example.com' });
        if (exists) {
            console.log('Admin already exists.');
        } else {
            await User.create({
                email: 'micah@ple.com',
                password: '123cah', // Dummy hash, won't work for login but fine for seed
                role: 'admin',
                plan: 'premium',
                apiKey: 'seed_api_key',
                apiKeyUses: -1
            });
            console.log('Admin user created!');
        }

        console.log('Seed successful. Collections should be visible now.');
        process.exit(0);
    } catch (error) {
        console.error('Seed Error:', error);
        process.exit(1);
    }
};

seed();
