// Minimal Tetris implementation — vanilla JS, Canvas
// Controls: ← → move, ↑ rotate, ↓ soft drop, Space hard drop, P pause

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nctx = nextCanvas.getContext('2d');
const COLS = 10; const ROWS = 20; const BLOCK = 24; // matches canvas size
const W = COLS * BLOCK; const H = ROWS * BLOCK;

let board = createMatrix(COLS, ROWS);
let score = 0, level = 1, lines = 0; let dropInterval = 1000; let dropCounter = 0; let lastTime = 0;
let current = null; let next = null; let paused = false; let running = false;

function createMatrix(w, h){
  const m = [];
  for(let y=0;y<h;y++){m[y]=Array(w).fill(0);} 
  return m;
}

function arenaClear(){
  board = createMatrix(COLS, ROWS);
}

const PIECES = 'IJLOSTZ'.split('');
function randPiece(){ return PIECES[Math.floor(Math.random()*PIECES.length)]; }

const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  J: [[2,0,0],[2,2,2],[0,0,0]],
  L: [[0,0,3],[3,3,3],[0,0,0]],
  O: [[4,4],[4,4]],
  S: [[0,5,5],[5,5,0],[0,0,0]],
  T: [[0,6,0],[6,6,6],[0,0,0]],
  Z: [[7,7,0],[0,7,7],[0,0,0]]
};

function makePiece(type){
  return SHAPES[type].map(row=>row.slice());
}

function collide(matrix, piece, offset){
  const [ox,oy]=[offset.x,offset.y];
  for(let y=0;y<piece.length;y++){
    for(let x=0;x<piece[y].length;x++){
      if(piece[y][x]!==0){
        if(!matrix[oy+y] || matrix[oy+y][ox+x] !== 0) return true;
      }
    }
  }
  return false;
}

function merge(matrix, piece, offset){
  for(let y=0;y<piece.length;y++){
    for(let x=0;x<piece[y].length;x++){
      if(piece[y][x]!==0){matrix[offset.y+y][offset.x+x]=piece[y][x];}
    }
  }
}

function rotate(piece, dir){
  for(let y=0;y<piece.length;y++){
    for(let x=0;x<y;x++){
      [piece[x][y], piece[y][x]] = [piece[y][x], piece[x][y]];
    }
  }
  if(dir>0) piece.forEach(row=>row.reverse()); else piece.reverse();
}

function playerReset(){
  current = {pos:{x:Math.floor(COLS/2)-1,y:0}, matrix:makePiece(next||randPiece())};
  next = randPiece();
  if(collide(board,current.matrix,current.pos)){
    arenaClear(); score=0; level=1; lines=0; running=false; showMessage('Game Over');
  }
}

function playerDrop(){
  current.pos.y++;
  if(collide(board,current.matrix,current.pos)){
    current.pos.y--;
    merge(board,current.matrix,current.pos);
    sweepLines();
    playerReset();
  }
  dropCounter=0;
}

function sweepLines(){
  let rowCount=0;
  outer: for(let y=ROWS-1;y>=0;y--){
    for(let x=0;x<COLS;x++) if(board[y][x]===0) continue outer;
    const row = board.splice(y,1)[0].fill(0);
    board.unshift(row);
    y++; rowCount++;
  }
  if(rowCount>0){
    lines+=rowCount;
    score += computeScore(rowCount);
    level = Math.floor(lines/10)+1;
    dropInterval = Math.max(100, 1000 - (level-1)*100);
  }
}

function computeScore(rows){
  const pts = [0,40,100,300,1200];
  return pts[rows]*level;
}

function playerMove(dir){
  current.pos.x += dir;
  if(collide(board,current.matrix,current.pos)) current.pos.x -= dir;
}

function playerRotate(dir){
  const pos = current.pos.x;
  rotate(current.matrix,dir);
  let offset = 1;
  while(collide(board,current.matrix,current.pos)){
    current.pos.x += offset;
    offset = -(offset + (offset>0 ? 1 : -1));
    if(offset > current.matrix[0].length) { rotate(current.matrix,-dir); current.pos.x = pos; return; }
  }
}

function hardDrop(){
  while(!collide(board,current.matrix,current.pos)) current.pos.y++;
  current.pos.y--;
  merge(board,current.matrix,current.pos);
  sweepLines();
  playerReset();
}

function draw(){
  ctx.clearRect(0,0,W,H);
  drawMatrix(board,{x:0,y:0});
  if(current) drawMatrix(current.matrix,current.pos);
  // UI
  document.getElementById('score').textContent = score;
  document.getElementById('level').textContent = level;
  document.getElementById('lines').textContent = lines;
  drawNext();
}

function drawMatrix(matrix, offset){
  for(let y=0;y<matrix.length;y++){
    for(let x=0;x<matrix[y].length;x++){
      if(matrix[y][x]!==0){
        ctx.fillStyle = colorFor(matrix[y][x]);
        ctx.fillRect(x*BLOCK + offset.x*BLOCK, y*BLOCK + offset.y*BLOCK, BLOCK-1, BLOCK-1);
      }
    }
  }
}

function drawNext(){
  nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
  const p = makePiece(next);
  const off = {x:1,y:1};
  for(let y=0;y<p.length;y++){
    for(let x=0;x<p[y].length;x++){
      if(p[y][x]){
        nctx.fillStyle = colorFor(p[y][x]);
        nctx.fillRect((off.x+x)*BLOCK/2, (off.y+y)*BLOCK/2, BLOCK/2-1, BLOCK/2-1);
      }
    }
  }
}

function colorFor(n){
  const cols = ['#000','#22c1ff','#3346ff','#ffb347','#ffd11a','#33d867','#c56cff','#ff4d4d'];
  return cols[n] || '#fff';
}

function showMessage(txt){
  const m = document.getElementById('message');
  m.textContent = txt || '';
  setTimeout(()=>m.textContent='',2000);
}

function update(time=0){
  if(!running || paused) { lastTime = time; requestAnimationFrame(update); return; }
  const delta = time - lastTime; lastTime = time; dropCounter += delta;
  if(dropCounter > dropInterval){ playerDrop(); }
  draw();
  requestAnimationFrame(update);
}

window.addEventListener('keydown',e=>{
  if(e.keyCode === 37) playerMove(-1); // left
  else if(e.keyCode === 39) playerMove(1); // right
  else if(e.keyCode === 38) playerRotate(1); // up
  else if(e.keyCode === 40){ playerDrop(); } // down
  else if(e.keyCode === 32){ e.preventDefault(); hardDrop(); } // space
  else if(e.key === 'p' || e.key === 'P'){ paused = !paused; showMessage(paused? 'Paused':''); }
});

document.getElementById('startBtn').addEventListener('click',()=>{
  arenaClear(); score=0; lines=0; level=1; dropInterval=1000; running=true; next=randPiece(); playerReset(); update();
});

// init draw
for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) board[y][x]=0;
draw();

// assistant tweak: small comment to trigger PR
