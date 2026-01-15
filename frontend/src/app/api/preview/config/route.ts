import { NextResponse } from 'next/server';

const responseBody = {
  provider: 'simple',
  configured: false,
  tokenValid: false,
  missing: ['CSB_API_KEY'],
  message: 'CodeSandbox preview is disabled in Simple Preview mode.'
};

export const GET = () => {
  return NextResponse.json(responseBody, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' }
  });
};
