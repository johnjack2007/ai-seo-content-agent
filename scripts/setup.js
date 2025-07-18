#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up AI SEO Content Agent...\n');

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env.local file...');
  const envExample = fs.readFileSync(path.join(process.cwd(), 'env.example'), 'utf8');
  fs.writeFileSync(envPath, envExample);
  console.log('✅ Created .env.local file');
  console.log('⚠️  Please update .env.local with your API keys before continuing\n');
} else {
  console.log('✅ .env.local file already exists\n');
}

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 18) {
  console.log('❌ Node.js 18+ is required. Current version:', nodeVersion);
  console.log('Please upgrade Node.js and try again.\n');
  process.exit(1);
} else {
  console.log('✅ Node.js version check passed:', nodeVersion, '\n');
}

// Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully\n');
} catch (error) {
  console.log('❌ Failed to install dependencies');
  console.log('Please run "npm install" manually\n');
  process.exit(1);
}

// Check if Supabase CLI is installed
try {
  execSync('supabase --version', { stdio: 'ignore' });
  console.log('✅ Supabase CLI is installed');
} catch (error) {
  console.log('⚠️  Supabase CLI not found');
  console.log('Please install Supabase CLI: https://supabase.com/docs/guides/cli\n');
}

console.log('🎉 Setup complete!');
console.log('\nNext steps:');
console.log('1. Update .env.local with your API keys');
console.log('2. Set up your Supabase project and run: npm run db:push');
console.log('3. Start the development server: npm run dev');
console.log('4. Open http://localhost:3000 in your browser');
console.log('\nFor detailed setup instructions, see README.md'); 