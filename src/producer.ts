import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const errorsQueue = new Queue('error-queue', {
    connection: redisConnection
})


interface Job {
    projectId: string;
    environmentName: string;
    type: string;
    level: string;
    message: string;
    stack_trace: string;
    metadata: any;
}

async function addErrorJob(error: Job): Promise<null | string> {
    const job = await errorsQueue.add('error', error,
        {
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 2000
            }
        }
    )
    if (!job) {
        return null;
    }
    return job.id;
}

export { addErrorJob }