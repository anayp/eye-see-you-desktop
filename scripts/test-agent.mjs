import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:4141');
let messageId = 1;

ws.on('open', () => {
  console.log('✅ Connected to Agent Bridge Protocol (ws://localhost:4141)');
  
  // 1. Initialize Handshake
  console.log('Sending initialize handshake...');
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'initialize',
    id: messageId++,
    params: {
      agent: 'test-agent/1.0',
      model: 'test-model',
      session_id: 'test-session-123'
    }
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  console.log(`\n⬇️ Received Response (ID: ${response.id || 'Notification'}):`);
  
  // Handle responses
  if (response.id === 1) {
    console.log('✅ Initialize OK:', response.result);
    
    // 2. Test set_context
    console.log('\nSetting context...');
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      id: messageId++,
      params: {
        name: 'set_context',
        arguments: { agent_name: 'Super Agent 3000', context_notes: 'I am testing the bridge' }
      }
    }));
  } else if (response.id === 2) {
    console.log('✅ Context Set OK:', response.result);
    
    // 3. Test get_scene_graph
    console.log('\nFetching Scene Graph...');
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      id: messageId++,
      params: { name: 'get_scene_graph' }
    }));
  } else if (response.id === 3) {
    console.log('✅ Scene Graph Received!');
    console.log(response.result.content[0].text.slice(0, 300) + '... (truncated)');
    
    // 4. Test remember_object
    console.log('\nTriggering remember_object...');
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      id: messageId++,
      params: { name: 'remember_object', arguments: { label: 'testing cube' } }
    }));
  } else if (response.id === 4) {
    console.log('✅ Remember Object OK:', response.result);
    console.log('\n🎉 All tests passed. Waiting for async telemetry... (Ctrl+C to exit)');
  } else if (response.method) {
    // Notification (e.g. audio_heard or vision_update)
    console.log(`🔔 Notification [${response.method}]:`, response.params);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket Error:', err.message);
  console.error('Make sure Eye-See-You is running on port 4141');
});

ws.on('close', () => {
  console.log('🔌 Disconnected from Bridge.');
});
