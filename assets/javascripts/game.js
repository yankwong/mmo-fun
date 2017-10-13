var YTK = YTK || {};

YTK.game = (function() {
  var 
  database = firebase.database(),
  showDiv = function($div) {
    $div.removeClass('hidden');
  },
  hideDiv = function($div) {
    $div.addClass('hidden');
  },
  initGame = function() {
    console.log('wow game started!');

    // hide login container
    hideDiv($('.login-container'));

    // show game container
    showDiv($('.game-container'));
  };


  return {
    start : initGame
  }
})();

$(document).on('gameStarted', function() {
  YTK.game.start();
});