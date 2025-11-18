
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars manually since we're running this with ts-node/node
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
  console.log('Checking storage bucket: real-vs-ai');
  
  // 1. Check if bucket exists (by trying to list root)
  const { data: rootFiles, error: rootError } = await supabase
    .storage
    .from('real-vs-ai')
    .list();

  if (rootError) {
    console.error('❌ Error listing bucket root:', rootError);
    console.log('👉 Hint: Check if the bucket "real-vs-ai" exists and is set to PUBLIC.');
    console.log('👉 Hint: Check if you have RLS policies allowing SELECT on storage.objects.');
    return;
  }

  console.log('✅ Bucket access successful. Root contents:', rootFiles.map(f => f.name));

  // 2. Check 'real' folder
  const { data: realFiles, error: realError } = await supabase
    .storage
    .from('real-vs-ai')
    .list('real');

  if (realError) {
    console.error('❌ Error listing "real" folder:', realError);
    return;
  }

  if (!realFiles || realFiles.length === 0) {
    console.warn('⚠️ "real" folder is empty or does not exist.');
    console.log('👉 Hint: Make sure you created a folder named "real" and uploaded images inside it.');
  } else {
    console.log(`✅ Found ${realFiles.length} files in "real" folder:`, realFiles.map(f => f.name));
    
    // 3. Check public URL for first file
    const firstFile = realFiles[0];
    if (firstFile) {
        const { data } = supabase.storage.from('real-vs-ai').getPublicUrl(`real/${firstFile.name}`);
        console.log('ℹ️ Public URL for first file:', data.publicUrl);
        console.log('👉 Try opening this URL in your browser to verify access.');
    }
  }
}

checkStorage().catch(console.error);
