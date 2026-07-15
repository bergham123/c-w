import { createGitHubClient } from './github.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const { username, email, password, confirmPassword } = await request.json();
    if (!username || !email || !password || !confirmPassword) {
      return new Response(JSON.stringify({ error: 'All fields are required' }), { status: 400 });
    }
    if (password !== confirmPassword) {
      return new Response(JSON.stringify({ error: 'Passwords do not match' }), { status: 400 });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), { status: 400 });
    }

    const github = createGitHubClient(env);
    let users = [];
    try {
      users = await github.getUsers();
    } catch (e) {}

    if (users.find(u => u.email === email)) {
      return new Response(JSON.stringify({ error: 'Email already registered' }), { status: 400 });
    }

    users.push({
      username,
      email,
      password, // مخزنة كنص عادي
      createdAt: new Date().toISOString()
    });

    await github.saveUsers(users);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Register error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
  }
}
