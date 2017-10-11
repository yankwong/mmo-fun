var YTK = YTK || {};

YTK.poker = (function() {
  var 
  database = firebase.database(),
  playerObj = {
    id        : -1,
    name      : '',
    startTime : '',
    money     : 0,
  },
  showDiv = function($div) {
    $div.removeClass('hidden');
  },
  hideDiv = function($div) {
    $div.addClass('hidden');
  },
  getAvailableUserID = function(snapshot) {
    for (var i=0; i < MAX_PLAYERS; i++) {
      if (!snapshot.hasChild(i + '')) {
        return i;
      }
    }
    return -1;
  },
  isGameFull = function(snapshot) {
    return getAvailableUserID(snapshot) === -1;
  },
  setPlayerObj = function(userObj) {
    playerObj = userObj;
  },
  addConnectedPlayer = function() {
    var $pRow   = $('<div class="player player-' + playerObj.id +'">'),
        $pName  = $('<span class="name">' + playerObj.name + '</span>'),
        $pBtn   = $('<button class="btn ready-btn" disabled data-id="' + playerObj.id +'">Ready</button>');

        $pRow.append($pName);
        $pRow.append($pBtn);

        $('.connected-players').append($pRow);
  },
  bindReadyBtn = function() {
    $('.connected-players').on('click', 'ready-btn', function() {
      // make sure there is more than 1 player
      // update firebase 
      // start a timer for all players
    });
  },
  handleJoinGame = function() {
    userName = $('.username', '.user-form').val().trim();

    if (userName !== '') {
      hideDiv($('.user-form'));
      database.ref().once('value', function(snapshot) {

        if (isGameFull(snapshot)) { // game is full
          console.log('game is full dude');
        }

        else {
          var userID = getAvailableUserID(snapshot);

          if (userID !== -1) {
            // init player object
            setPlayerObj({
              id        : userID,
              name      : userName,
              startTime : Date.now(),
              money     : INIT_MONEY
            });
            
            // push to database
            YTK.db.dbSet(userID, playerObj);
            
            // update message box
            addConnectedPlayer();
          }
        }
      });
    }
  },
  bindJoinBtn = function() {
    var $joinBtn = $('.join-btn'),
        userName;

    $joinBtn.on('click', function() {
      handleJoinGame();
    });

    $('.username', '.user-form').on('keyup', function(e) {
      if (e.keyCode == 13) {
        handleJoinGame();
      }
    });
  },
  bindAvatarSelect = function() {
    var $avatarBtn = $('.avatar', '.avatar-select');

    $avatarBtn.on('click', function() {
      showDiv($('.user-form', '.login-container'));
    });
  },
  // remove user table from DB if a user disconnected
  bindDisconnect = function() {
    $(window).bind("beforeunload", function() {
      if (playerObj.id !== -1) {
        YTK.db.dbRemoveNode(playerObj.id);
      }
      return undefined;
    });
  },
  initLogin = function() {
    bindDisconnect();

    // login page
    bindAvatarSelect();
    bindJoinBtn();
    bindReadyBtn();

    // when the game is ready to start, trigger an event
    // for the rest of the page to listen to
    /*
    $.event.trigger({
      type: "newMessage",
      message: "Hello World!",
      time: new Date()
    });
    */
  };

  return {
    initLogin : initLogin
  }
})();

$(function() {
  YTK.poker.initLogin();
});