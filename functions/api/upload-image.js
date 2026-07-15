import { createGitHubClient } from './github.js';

export async function onRequest(context) {
    const { request, env } = context;
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
    }

    try {
        const { filename, base64 } = await request.json();
        if (!filename || !base64) {
            return new Response(JSON.stringify({ error: 'Filename and base64 are required' }), { status: 400 });
        }

        const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
        const path = `images/${cleanName}`;

        const github = createGitHubClient(env);
        await github.uploadFileRaw(path, base64, `Upload ${cleanName}`);

        const rawUrl = `https://raw.githubusercontent.com/${env.OWNER}/${env.REPO}/main/${path}`;
        return new Response(JSON.stringify({ success: true, url: rawUrl }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
