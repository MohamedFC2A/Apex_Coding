import { NextResponse } from 'next/server';

const responseBody = {
  provider: 'simple',
  sandboxConnection: 'disabled',
  message: 'Diagnostics are unavailable when Simple Preview is active.'
};

export const GET = () => {
  return NextResponse.json(responseBody, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' }
  });
};
