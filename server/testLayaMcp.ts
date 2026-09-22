import { planDiagramWithLaya, applyDiagramPlan } from './layaCanvas.js';
import { boardStore } from './boardStore.js';

async function testLaya() {
  console.log('🧪 Testing WhiteboardX Laya Canvas Integration...\n');

  const testPrompts = [
    'Draw an OAuth login flowchart with validation check and retry logic',
    'Create an infrastructure architecture diagram with frontend, gateway, and database',
  ];

  for (const prompt of testPrompts) {
    console.log(`\n--- Planning prompt: "${prompt}" ---`);
    const plan = await planDiagramWithLaya(prompt);
    console.log(`Classified diagram_type: ${plan.diagram_type} (Engine: ${plan.engine})`);
    console.log(`Shapes: ${plan.shapes.length}, Arrows: ${plan.arrows.length}, Frames: ${plan.frames.length}`);

    const result = applyDiagramPlan(plan, 'test_laya_board');
    console.log('Applied to board:', result);
  }

  const summary = boardStore.getBoardSummary('test_laya_board');
  console.log(`\nSummary of test_laya_board: ${summary.totalShapes} shapes, ${summary.totalRecords} records.`);

  // Cleanup test board
  boardStore.clearBoard('test_laya_board', false);
  console.log('\n✅ WhiteboardX Laya Canvas Integration successfully verified!');
}

testLaya().catch((err) => {
  console.error('❌ Laya test failed:', err);
  process.exit(1);
});
