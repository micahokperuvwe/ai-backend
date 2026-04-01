import mongoose, { Document, Schema } from 'mongoose';

export interface IAgentLog extends Document {
    userId: mongoose.Types.ObjectId;
    command: string;
    output: string;
    timestamp: Date;
}

const AgentLogSchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    command: { type: String, required: true },
    output: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

export default mongoose.model<IAgentLog>('AgentLog', AgentLogSchema);
