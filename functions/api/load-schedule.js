import { createGitHubClient } from './github.js';

export async function onRequest(context) {
    const { env } = context;
    try {
        const github = createGitHubClient(env);
        const raw = await github.getRawFile('.github/workflows/send.yaml');
        const match = raw.content.match(/cron:\s*'([^']+)'/);
        if (match) {
            const cron = match[1];
            const parts = cron.split(' ');
            const minute = parts[0];
            const hour = parts[1];
            const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
            return new Response(JSON.stringify({ time }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response(JSON.stringify({ time: '' }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ time: '' }), { status: 200 });
    }
}
