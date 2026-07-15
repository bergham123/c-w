import * as jose from 'jose';
import { createGitHubClient } from './github.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400 });
    }

    const github = createGitHubClient(env);
    let users = await github.getUsers(); // ترجع [] إذا غاب الملف

    if (!users || users.length === 0) {
      // أنشئ مستخدم افتراضي
      users = [{
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        createdAt: new Date().toISOString()
      }];
      await github.saveUsers(users);
    }

    const user = users.find(u => u.email === email);
    if (!user || user.password !== password) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }

    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const token = await new jose.SignJWT({ email: user.email, username: user.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(secret);

    return new Response(JSON.stringify({
      success: true,
      token,
      user: { email: user.email, username: user.username }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
  }
}
