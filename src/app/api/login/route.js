import { NextResponse } from "next/server";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export async function POST(request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Enter both your email and password." }, { status: 400 });
  }

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    // Env vars not configured on the server — fail closed, not open.
    return NextResponse.json({ error: "Login is not configured." }, { status: 500 });
  }

  const emailMatches = email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
  const passwordMatches = password === ADMIN_PASSWORD;

  if (!emailMatches || !passwordMatches) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("faceless_studio_admin_session", "true", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // 30 days if "remember" was checked, otherwise session-only cookie.
    maxAge: request.headers.get("x-remember") === "true" ? 60 * 60 * 24 * 30 : undefined,
  });

  return response;
}