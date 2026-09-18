import { boardStore } from './boardStore.js';

async function testTools() {
  console.log('🧪 Testing WhiteboardX Board Operations & MCP Tools...\n');

  // 1. Clear existing board
  console.log('1. Clearing board...');
  const clearRes = boardStore.clearBoard('default', false);
  console.log('   Result:', clearRes);

  // 2. Create frame
  console.log('\n2. Creating frame "AI Agent Architecture"...');
  const frameRes = boardStore.createFrame({
    boardId: 'default',
    title: 'AI Agent Architecture',
    x: 50,
    y: 50,
    width: 800,
    height: 500,
  });
  console.log('   Frame ID:', frameRes.id);

  // 3. Create sticky note 1
  console.log('\n3. Creating Note 1: User Request...');
  const note1 = boardStore.createStickyNote({
    boardId: 'default',
    text: 'User Prompt:\n"Design a local-first canvas"',
    color: 'yellow',
    x: 100,
    y: 150,
  });
  console.log('   Note 1 ID:', note1.id);

  // 4. Create Shape: LLM Reasoning Engine
  console.log('\n4. Creating Shape: Reasoning Engine...');
  const shape1 = boardStore.createShape({
    boardId: 'default',
    type: 'diamond',
    label: 'AI Reasoning Engine\n(Gemini / Claude)',
    width: 200,
    height: 140,
    x: 360,
    y: 140,
    color: 'violet',
    fill: 'semi',
  });
  console.log('   Shape 1 ID:', shape1.id);

  // 5. Create sticky note 2: Action Executed
  console.log('\n5. Creating Note 2: Visual Canvas Nodes...');
  const note2 = boardStore.createStickyNote({
    boardId: 'default',
    text: 'Live TLDraw Canvas\nRendered on Screen ✨',
    color: 'green',
    x: 640,
    y: 150,
  });
  console.log('   Note 2 ID:', note2.id);

  // 6. Connect Note 1 -> Shape 1
  console.log('\n6. Connecting Note 1 -> Shape 1...');
  const conn1 = boardStore.connectNodes({
    boardId: 'default',
    source_id: note1.id,
    target_id: shape1.id,
    label: 'Dispatches MCP',
    color: 'blue',
  });
  console.log('   Arrow 1 ID:', conn1.arrowId);

  // 7. Connect Shape 1 -> Note 2
  console.log('\n7. Connecting Shape 1 -> Note 2...');
  const conn2 = boardStore.connectNodes({
    boardId: 'default',
    source_id: shape1.id,
    target_id: note2.id,
    label: 'Realtime WS Broadcast',
    color: 'green',
  });
  console.log('   Arrow 2 ID:', conn2.arrowId);

  // 8. Fetch Board State Summary
  console.log('\n8. Getting Board State Summary...');
  const summary = boardStore.getBoardSummary('default');
  console.log('   Summary:');
  console.log(`   - Board Name: ${summary.name}`);
  console.log(`   - Total Shapes: ${summary.totalShapes}`);
  console.log(`   - Total Records: ${summary.totalRecords}`);
  console.log('   Shapes list:');
  summary.shapes.forEach((s) => {
    console.log(`     * [${s.type}] ${s.id} (label: "${s.label || ''}") pos: (${s.x}, ${s.y})`);
  });

  console.log('\n✅ All WhiteboardX Board Operations Tested Successfully!\n');
}

testTools().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
