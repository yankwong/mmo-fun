//System Vars
var stage = document.getElementById("gameCanvas");
stage.width = STAGE_WIDTH;
stage.height = STAGE_HEIGHT;
var ctx = stage.getContext("2d");
ctx.fillStyle = "grey";
ctx.font = GAME_FONTS;

var charImage;

function setupCharImg() {
  charImage = new Image();
  charImage.ready = false;
  charImage.onload = function() {
    this.ready = true;
  };
  charImage.src = 'assets/images/sprite/spritesheet2.png';
}

setupCharImg();

clearCanvas();

//Display Preloading
ctx.fillText(TEXT_PRELOADING, TEXT_PRELOADING_X, TEXT_PRELOADING_Y);
var preloader = setInterval(preloading, TIME_PER_FRAME);

var gameloop, facing, currX, currY, charX, charY, isMoving;

function preloading() { 
  if (charImage.ready) {
    clearInterval(preloader);
    
    //Initialize game
    facing = "E"; //N = North, E = East, S = South, W = West
    isMoving = false;
    
    gameloop = setInterval(update, TIME_PER_FRAME);     
    document.addEventListener("keydown",keyDownHandler, false); 
    document.addEventListener("keyup",keyUpHandler, false); 
  }
}

//Key Handlers
function keyDownHandler(event) {
  var keyPressed = String.fromCharCode(event.keyCode);

  if (keyPressed == "W") {
    facing = "N";
    isMoving = true;
  }
  else if (keyPressed == "D") { 
    facing = "E";
    isMoving = true;    
  }
  else if (keyPressed == "S") {
    facing = "S";
    isMoving = true;    
  }
  else if (keyPressed == "A") {
    facing = "W";
    isMoving = true;    
  }
}

function keyUpHandler(event) {
  var keyPressed = String.fromCharCode(event.keyCode);
  
  if ((keyPressed == "W") || (keyPressed == "A") || 
    (keyPressed == "S") || (keyPressed == "D"))
  {
    isMoving = false;
  }
}

function clearCanvas() {
  ctx.fillStyle = "grey";
  ctx.fillRect(0, 0, stage.width, stage.height);  
}

//Game Loop
charX = CHAR_START_X;
charY = CHAR_START_Y;

currX = IMAGE_START_X;
currY = IMAGE_START_EAST_Y;

function hitWall(direction) {
  if (direction === 'N') {
    return charY <= -25;
  }
  else if (direction === 'E') {
    return charX > (STAGE_WIDTH - CHAR_WIDTH);
  }
  else if (direction === 'S') {
    return charY > (STAGE_HEIGHT - CHAR_HEIGHT);
  }
  else {
    return charX <= 0;
  }
}

function update() {   

  clearCanvas();
  
  if (isMoving) {
    if (facing == "N") {
      if (!hitWall('N')) charY -= CHAR_SPEED;
      currY = IMAGE_START_NORTH_Y;
    }
    else if (facing == "E") {
      if (!hitWall('E')) charX += CHAR_SPEED;
      currY = IMAGE_START_EAST_Y;
    }
    else if (facing == "S") {
      if (!hitWall('S')) charY += CHAR_SPEED;
      currY = IMAGE_START_SOUTH_Y;
    }
    else if (facing == "W") {
      if (!hitWall('W')) charX -= CHAR_SPEED;
      currY = IMAGE_START_WEST_Y;
    }
    console.log('x: ' + charX, 'y: ' + charY);
    currX += CHAR_WIDTH;
    
    if (currX >= SPRITE_WIDTH)
      currX = 0;
  }
  
  //Draw Image, will update sprite cursor
  ctx.drawImage(charImage,currX,currY,CHAR_WIDTH,CHAR_HEIGHT,
          charX,charY,CHAR_WIDTH,CHAR_HEIGHT);

}