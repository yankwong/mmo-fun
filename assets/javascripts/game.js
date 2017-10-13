// this file contain codes for the actual game
// a "gameStarted" event will be triggered from login.js when
// enough players are logged in and ready

$(document).on('gameStarted', function() {
  
  console.log('wow game started!');

  // hide login container
  $('.login-container').addClass('hidden');
  
  // show game container
  $('.game-container').removeClass('hidden');

});