//TODO: QA login/dc logic
var YTK = YTK || {};

YTK.poker = (function() {
  var 
  database = firebase.database(),
  playerObj = {
    id        : -1,
    name      : '',
    avatar    : -1,
    startTime : '',
    money     : 0,
    ready     : false
  },
  connectedPlayers = [],
  countDownStarted = false,
  startCounter = COUNTDOWN_TIMER,

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
  addConnectedPlayer = function(pObj) {
    var $pRow   = $('<div class="player player-' + pObj.id +'" data-pid="' + pObj.id + '">'),
        $pName  = $('<span class="name">' + pObj.name + '</span>'),
        $pDC    = $('<button class="btn btn-outline-danger dc-btn">Quit</button>'),
        $pBtn   = $('<button class="btn btn-outline-success ready-btn" data-id="' + playerObj.id +'">Ready</button>');

      $pRow.append($pName);

      if (playerObj.id == pObj.id) {
        $pRow.append($pBtn);
        $pRow.append($pDC);
      }

      $('.connected-players').append($pRow);
  },
  bindDCBtn = function() {
    $('.connected-players').on('click', 'dc-btn', function() {
      if (playerObj.id !== -1) {
        YTK.db.dbRemoveNode(playerObj.id);
      }
    });
  },
  bindReadyBtn = function() {
    $('.connected-players').on('click', '.ready-btn', function() {

      if (connectedPlayers.length > 1) {
        playerObj.ready = true;

        // update firebase
        YTK.db.dbSet(playerObj.id, playerObj);
      }
    });
  },
  getOnlinePlayers = function(snapshot) {

    connectedPlayers = [];
    snapshot.forEach(function(snap) {
      var node = snap.val();

      connectedPlayers.push({
        id        : node.id,
        name      : node.name,
        avatar    : node.avatar,
        startTime : node.startTime,
        money     : node.money,
        ready     : node.ready
      });

      addConnectedPlayer({
        id    : node.id,
        name  : node.name
      });
    });
  },
  handleJoinGame = function() {
    var userName = $('.username', '.user-form').val().trim();

    if (userName !== '') {
      hideDiv($('.user-form'));
      database.ref().once('value', function(snapshot) {

        //display all players currently logged in
        getOnlinePlayers(snapshot);

        if (isGameFull(snapshot)) { // game is full
          console.log('game is full dude');
        }

        else {
          var userID = getAvailableUserID(snapshot);

          showDiv($('.connected-players'));

          if (userID !== -1) {
            // init player object
            setPlayerObj({
              id        : userID,
              name      : userName,
              avatar    : playerObj.avatar,
              startTime : Date.now(),
              money     : INIT_MONEY,
              ready     : false
            });
            
            // push to database
            YTK.db.dbSet(userID, playerObj);

            // start DB event listener
            bindDBListener();
          }
        }
      });
    }
  },
  bindJoinBtn = function() {
    var $joinBtn = $('.join-btn');

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
      $(this).addClass('picked');
      playerObj.avatar = parseInt($(this).attr('data-id'));
      showDiv($('.user-form', '.login-container'));
      hideDiv($avatarBtn.not('.picked'));
    });

  },
  // remove user table from DB if a user disconnected
  bindDisconnect = function() {
    $(window).bind("beforeunload", function() {
      if (playerObj.id !== -1) {
        YTK.db.dbRemoveNode(playerObj.id);
      }
      // if a "ready" player disconnect, remove counter from DB
      if (playerObj.ready === true) {
        YTK.db.dbRemoveNode('countdown');
      }
      return undefined;
    });
  },
  clearDiv = function($div) {
    $div.empty();
  },
  hasReadyPlayers = function(snapshot) {

    var retVal = false;

    snapshot.forEach(function(snap) {
      var node = snap.val();

      if (node.ready == true) {
        retVal = true;
      }
    });

    return retVal;
  },

  resetStartCounter = function() {
    startCounter = COUNTDOWN_TIMER;
  },
  countDownListener = function() {
    // if counter exist
    // countDownStarted = true, also update startCounter
    // else countDownStarted = false

    // on another function, set a listener to firebase counter
    // var $counterDiv = $('.start-counter', '.network-info')
    // $counterDiv.html(startCounter);
  },
  startCountdown = function() {
    var countdownInterval;

    if (!countDownStarted) {
      // push a counter to firebase
      YTK.db.dbSet('countdown', startCounter);
      countdownInterval = setInterval(function() {
      if (startCounter === 0) {
        clearInterval(countdownInterval);
      }
        startCounter --;
      }, 1000);

      resetStartCounter();
    }
  },
  updateRdyBtn = function() {
    var $rdyBtns = $('.ready-btn');
    if (connectedPlayers.length === 1) {
      $rdyBtns.prop('disabled', true);
      $rdyBtns.addClass('btn-outline-secondary');
      $rdyBtns.removeClass('btn-outline-success');
    }
    else {
      $rdyBtns.prop('disabled', false);
      $rdyBtns.removeClass('btn-outline-secondary');
      $rdyBtns.addClass("btn-outline-success");
    }
  },
  bindDBListener = function() {
    database.ref().on('value', function(snapshot) {
      console.log('db value changed', snapshot.val());
      clearDiv($('.connected-players', '.login-container'));

      getOnlinePlayers(snapshot);

      updateRdyBtn();

      if (hasReadyPlayers(snapshot)) {
        startCountdown();
      }
    });
  },
  bindQuitBtn = function() {
    $('.connected-players').on('click', '.dc-btn', function() {
      location.reload();
    });
  },
  initLogin = function() {
    bindDisconnect();
    bindQuitBtn();

    // login page
    bindAvatarSelect();
    bindJoinBtn();
    bindReadyBtn();
    bindDCBtn();

    // when the game is ready to start, trigger an event
    // for the rest of the page to listen to
    /*
    $( document ).trigger( "gameStarted", [ "bim", "baz" ] );
    */
  };

  return {
    initLogin : initLogin
  }
})();

$(function() {
  YTK.poker.initLogin();
});