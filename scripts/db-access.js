const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ggwoupzaruiaaliylyxga.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchData() {
  // Get all tubes (1, 2, 3)
  const tubeNumbers = [1, 2, 3];
  const bundledContent = {};
  const manifest = {
    version: 1,
    generated: new Date().toISOString(),
    tubes: {},
    stats: {
      tubeCount: 3,
      threadCount: 3,
      stitchCount: 30 // 10 stitches per tube
    }
  };
  
  for (const tubeNumber of tubeNumbers) {
    console.log(`Processing Tube ${tubeNumber}...`);
    
    // Get the first thread for this tube
    const { data: threads, error: threadError } = await supabase
      .from('threads')
      .select('id, title')
      .eq('tube_number', tubeNumber)
      .order('id')
      .limit(1);
    
    if (threadError) {
      console.error(`Error fetching thread for tube ${tubeNumber}:`, threadError);
      continue;
    }
    
    if (!threads || threads.length === 0) {
      console.error(`No thread found for tube ${tubeNumber}`);
      continue;
    }
    
    const thread = threads[0];
    const threadId = thread.id;
    console.log(`Found thread ${threadId} for tube ${tubeNumber}`);
    
    // Get the first 10 stitches for this thread, ordered by their position
    const { data: stitches, error: stitchError } = await supabase
      .from('stitches')
      .select('*, questions(*)')
      .eq('thread_id', threadId)
      .order('order')
      .limit(10);
    
    if (stitchError) {
      console.error(`Error fetching stitches for thread ${threadId}:`, stitchError);
      continue;
    }
    
    console.log(`Found ${stitches?.length || 0} stitches for thread ${threadId}`);
    console.log(stitches ? stitches[0] : 'No stitches');
  }
}

fetchData().catch(console.error);