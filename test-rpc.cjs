const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testRpc() {
    const email = 'test-rpc' + Date.now() + '@example.com';
    const { data: authData, error: signupError } = await supabase.auth.signUp({ 
        email, 
        password: 'password123' 
    });
    if (signupError) { console.error('SIGNUP ERROR', signupError); return; }
    
    console.log('User created:', authData.user.id);
    
    const { data, error } = await supabase.rpc('register_tenant_admin', {
        p_user_id: authData.user.id,
        p_tenant_name: 'Test RPC Company',
        p_slug: 'test-rpc-' + Date.now(),
        p_display_name: 'RPC Tester'
    });
    console.log('RPC RESULT:', { data, error });
}
testRpc();