// utility object to interact Deck of Card API
var YTK = YTK || {};

YTK.cards = (function() {
  var 
  makeQuery = function(apiURL, paramObj) {
    var url = apiURL + '?' + $.param(paramObj);
    return url;
  },
  callAPI = function(url, callback) {
    $.ajax({
      url: url,
    })
    .done(function(results) {
      console.log('card API: ', results);
      callback(results);
    })
    .fail(function() {
      console.log('%ccardAPI ajax failed', 'color: red; font-weight: bold;');
    })
  },
  getDeckStat = function(deckID, callback) {
    var url = 'https://deckofcardsapi.com/api/deck/' + deckID + '/';
    callAPI(url, callback);
  },
  initDeck = function(deckTotal, callback) {
    var url = 'https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=' + deckTotal;
    callAPI(url, callback);
  },
  getImg = function(cardID) {
    return 'http://deckofcardsapi.com/static/img/' + cardID + '.png';
  },
  drawCards = function(deckID, total, callback) {
    var url = 'https://deckofcardsapi.com/api/deck/' + deckID + '/draw/?count=' + total;
    callAPI(url, callback);
  };
  return {
    initDeck  : initDeck,
    drawCards : drawCards,
    getDeckStat : getDeckStat,
    getImg : getImg,
  }
})();
var MAX_PLAYERS = 5,
    INIT_MONEY  = 100,
    COUNTDOWN_TIMER = 1,
    TOTAL_DECK = 1;
// utility object to interact with FireBase
var YTK = YTK || {};

YTK.db = (function() {
  var 
  database = firebase.database(),
  dbPush = function(table, obj){
    database.ref(table).push(obj);
  },
  dbRemoveItem = function(key) {
    database.ref().child(key).remove();
  },
  dbBindListener = function(table, event, callback) {
    database.ref(table).on(event, callback);
  },
  dbSet = function(node, obj) {
    database.ref('/' + node).set(obj);
  },
  dbUpdate = function(node, obj) {
    database.ref('/' + node).update(obj);
  },
  dbRemoveNode = function(node) {
    database.ref('/' + node).remove();
  };

  return {
    dbPush        : dbPush,
    dbRemoveItem  : dbRemoveItem,
    dbBind        : dbBindListener,
    dbSet         : dbSet,
    dbRemoveNode  : dbRemoveNode,
    dbUpdate      : dbUpdate
  }
})();
var YTK = YTK || {} ;
//hello this is a test
YTK.game = (function() {
  var 
  deckObj = {
    id : '',
    shuffled : false,
    remaining : 52,
    community: null
  },
  playerObj = {
    id        : -1,
    name      : '',
    avatar    : -1,
    startTime : '',
    money     : 0,
    ready     : false,
    host      : false,
    hand      : '[]',
    community : '[]',
    communityShown : false,
  }, 
  seats = [], // a 1:1 matching of seat-ID : player-ID
  stateObj = {  // keep track of various state of the program
    canPutFakeCard    : true,   // never reset
    communityDrawFree : true,   // reset
    canAssignSeat     : true,   // reset
    needPlayersStats  : true,   // never reset
    seesGameStats     : false,  //set to true when game options/stats displayed
  },
  cardAPIFree = true, 
  connectedPlayers = [],
  database = firebase.database(),
  showDiv = function($div) {
    $div.removeClass('hidden'); 
  },
  hideDiv = function($div) {
    $div.addClass('hidden');
  },
  isPlayerNode = function(node) { // is this Node a player node?
    return node.hasOwnProperty('host');
  },
  updateDeckObj = function(obj) {
    console.log('... writing deck', obj);
    deckObj.id        = obj.id;
    deckObj.shuffled  = obj.shuffled;
    deckObj.remaining = obj.remaining;
  },
  getPlayerHand = function(pObj) { // get an array of a player's hand
    return JSON.parse(pObj.hand);
  },
  endGame = function(info) {
    console.log('game ended', info);
    YTK.db.dbRemoveNode('game');
  },
  initPlayerObj = function(playerID) {
    database.ref('/' + playerID).once('value', function(snap) {
      playerObj = {
        id        : snap.val()['id'],
        name      : snap.val()['name'],
        avatar    : snap.val()['avatar'],
        startTime : snap.val()['startTime'],
        money     : snap.val()['money'],
        ready     : snap.val()['ready'],
        host      : snap.val()['host'],
      }
    });
  },
  isHost = function() {
    return playerObj.host; 
  },
  initialDraw = function(result) {
    if (result.success) {
      var handArray = [],
          $selfHand = $('.hand', '.player-0');
      // 1. update the user's hand
      for (var i = 0; i < result.cards.length; i++) {
        handArray.push(result.cards[i].code);
        putCard($selfHand, result.cards[i].code);
      }
      playerObj.hand = JSON.stringify(handArray);

      // update firebase with player's hand
      YTK.db.dbUpdate(playerObj.id, {hand : playerObj.hand});

      cardAPIFree = true;
    }
  },
  updatePlayersArray = function(snapshot) {
    connectedPlayers = [];
    snapshot.forEach(function(snap) {
      var node = snap.val();

      if (isPlayerNode(node)) { 
        connectedPlayers.push({
          id        : node.id,
          name      : node.name,
          avatar    : node.avatar,
          startTime : node.startTime,
          money     : node.money,
          ready     : node.ready,
          host      : node.host,
          hand      : node.hand || '[]',
        });  
      }
    });
  },
  haveHand = function(pObj) {
    return pObj.hasOwnProperty('hand') && JSON.parse(pObj.hand).length > 0;
  },
  allHaveHand = function() {
    var retVal = true;
    $.each(connectedPlayers, function(index, player) {
      if (!haveHand(player)) {
        retVal = false;
      }
    });

    return retVal;
  },
  playerNodesListener = function(snapshot) {
    updatePlayersArray(snapshot);
  },
  getDBGameRound = function(node) {
    if (node.hasOwnProperty('round')) {
      return node.round;
    }
    else {
      return -1;
    }
  },
  putCard = function($div, cardCode) {
    var $card = $('<div class="poker-card"><img src="' + YTK.cards.getImg(cardCode) + '" class="card-img"></div>');
    $div.append($card);
  },
  updateDBDeck = function() {
    YTK.cards.getDeckStat(deckObj.id, function(result) {
      console.log('updating db deck', result);
      YTK.db.dbSet('deck', {
        id        : result.deck_id, 
        shuffled  : result.shuffled,
        remaining : result.remaining
      });
    });
  },
  communityDraw = function(result) {
    var communityArray = [],
      $communityCards = $('.community-area')

    for (var i = 0; i < result.cards.length; i++) {
      communityArray.push(result.cards[i].code);
      putCard($communityCards, result.cards[i].code);
    }

    playerObj.community = JSON.stringify(communityArray);
    cardAPIFree = true;
    playerObj.communityShown = true;
  },
  putFakeCards = function($div, total) {    
    for (var i=0; i<total; i++) {
      var $fakeCard = $('<div class="poker-card"><img src="assets/images/card-face-down.png" class="fake-card"></div>');
      $div.append($fakeCard);
    }
  },

  assignSeats = function() {
    stateObj.canAssignSeat = false;
    if (seats.length === 0 && connectedPlayers.length > 1) {
      seats.push(playerObj.id);
      $.each(connectedPlayers, function(index, player) {
        if (player.id !== playerObj.id){
          seats.push(player.id);
        }
      });
    }
    else {
      console.log('%cAssign Seat Error', 'font-weight: bold; color: red;');
    }
    stateObj.canAssignSeat = true;
  },
  putPlayerStat = function(pObj) {
    var seatID = seats.indexOf(pObj.id),
        $seat = $('.seat.player-' + seatID);

    $seat.find('.avatar').addClass('avatar-' + pObj.avatar);
    $seat.find('.name').html(pObj.name);
    $seat.find('.money').html('<i class="fa fa-usd" aria-hidden="true"></i>' + pObj.money);
  },
  // main function to determine what to do in each round
  gameRoundListener = function(snapshot) {
    var gameNode = snapshot.val()['game'],
        dbGameRound = getDBGameRound(gameNode);

    // ROUND 0: player draw two cards
    // a seat is assigned to each player
    // firebase is updated with player's hand
    // firebase is updated with new deck info
    if (dbGameRound === 0) {
      console.log('%c--- ROUND 0 ---', 'font-weight: bold; color: gold');

      hideDiv($('.page-loader'));

      if (stateObj.canAssignSeat && seats.length === 0) {
        assignSeats();
      }

      // update all players stat (except player 0 for now)
      if (stateObj.needPlayersStats) {
        stateObj.needPlayersStats = false;
        for (var i=1; i<seats.length; i++) {
          var player = connectedPlayers[seats[i]];
          putPlayerStat(player);
        }  
      }
      

      if (!haveHand(playerObj)) {
        if (deckObj.id !== '' && cardAPIFree) {
          cardAPIFree = false;
          console.log('> drawing 2 cards...', playerObj);
          YTK.cards.drawCards(deckObj.id, 2, function(result) {
            initialDraw(result);
          });      
        }
      }
      else if (allHaveHand()) {

        YTK.db.dbUpdate('game', {round : 1});

        // put two fake cards on table
        if (stateObj.canPutFakeCard) {
          stateObj.canPutFakeCard = false;

          for (var i=1; i < connectedPlayers.length; i++) {
            putFakeCards($('.seat.player-' + i), 2);
          }  
        }

        // HOST: draw commuinty card 
        if (isHost() && cardAPIFree) {
          cardAPIFree = false;
          YTK.cards.drawCards(deckObj.id, 3, function(result) {
            communityDraw(result);
            YTK.db.dbUpdate('game', {communityHand : result, howManySeeCommunity : 1, howManySeeGameStats : 0})
          });
        }
      }
    }
    // ROUND 1: first deal of the commuinty deck
    else if (dbGameRound === 1) {
      console.log('%c--- ROUND 1 ---', 'font-weight: bold; color: gold');

      if (isHost()) {
        updateDBDeck();
      } 
      else {
        console.log('round1: ', stateObj.communityDrawFree)
        if (!playerObj.communityShown && stateObj.communityDrawFree) {

          stateObj.communityDrawFree = false;

          database.ref('/game').once('value', function(snap) {
            if (snap.hasChild('communityHand')) {
              communityDraw(snap.val()['communityHand']);
              var count = snap.val()['howManySeeCommunity'] + 1
              YTK.db.dbUpdate('game', {howManySeeCommunity : count})
            }
            stateObj.communityDrawFree = true;
          });

        }
      }

      //Once all see community
      database.ref('/game').once('value', function(snap) {
        if (snap.val()['howManySeeCommunity'] === connectedPlayers.length && !stateObj.seesGameStats) {
          stateObj.seesGameStats = true
          var count = snap.val()['howManySeeGameStats'] += playerObj.id
          YTK.db.dbUpdate('game', {howManySeeGameStats: count})
          //YTK.db.dbUpdate('game', {moneyOnTable: connectedPlayers.length*5})
          var btn = $("<button>")
          btn.html("test")
          $(".player-0").prepend(btn)
        }
      })
      // pop-up modal to let player pick an action
      // ?? is it turn based?, like is there an order of who act first?

      // notice the modal has a local timer, when it runs out it's auto "pass"

      // if a player have <= 0 money, he lose the game and can no longer do action
      // when it goes to their turn it auto pass

      // at the end of each round, updateDBDeck()
    }
  },
  displayChoices = function(user) {

  },
  setDeckListener = function(snapshot) {
    var snap = snapshot.val();
    if (snap.hasOwnProperty('deck')) {
      updateDeckObj({
        id        : snap['deck'].id,
        shuffled  : snap['deck'].shuffled,
        remaining : snap['deck'].remaining
      });
    }
  },
  setDBListener = function() { // listen to all firebase changes
    database.ref().on('value', function(snapshot) {
      console.log('(DB-Value, game)', snapshot.val());

      // on DB deck change: update local deck
      setDeckListener(snapshot);
      
      // on DB player change: update local players
      playerNodesListener(snapshot);

      // on DB game.round: determine what to do
      gameRoundListener(snapshot);
    });
  },
  initGame = function(playerID) {
    showDiv($('.page-loader'));

    hideDiv($('.login-container'));
    showDiv($('.game-container'));

    initPlayerObj(playerID);

    setDBListener();

    if (isHost()) {
      YTK.cards.initDeck(TOTAL_DECK, function(result) {
        
        if (result.success) {
          updateDeckObj({
            id : result.deck_id,
            shuffled : result.shuffled,
            remaining : result.remaining
          });

          // start of ROUND 0
          YTK.db.dbUpdate('game', {round : 0});
          // push deck to firebase
          YTK.db.dbSet('deck', deckObj);
        }
        else {
          endGame('Error getting a deck');
        }
      });  
    }
  };

  return {
    start : initGame
  }
})();

$(document).on('gameStarted', function(e, playerID) {
  YTK.game.start(playerID);
});
//TODO: QA login/dc logic
var YTK = YTK || {};

YTK.login = (function() {
  var 
  database = firebase.database(),
  playerObj = {
    id        : -1,
    name      : '',
    avatar    : -1,
    startTime : '',
    money     : 0,
    ready     : false,
    host      : false
  },
  countdownInterval = null,
  connectedPlayers = [],
  startCounter,
  loginDBListener,
  gameStarted = false,
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
        $pWait  = $('<span class="status hidden">Waiting...</span>'),
        $pReady = $('<span class="status hidden">Ready!</span>'),
        $pDC    = $('<button class="btn btn-outline-danger dc-btn">Quit</button>'),
        $pBtn   = $('<button class="btn btn-outline-success ready-btn" data-id="' + playerObj.id +'">Ready</button>');

      $pRow.append($pName);

      if (playerObj.id == pObj.id) {
        $pRow.append($pDC);
        if (!pObj.ready) {
          $pRow.append($pBtn);
        }
      }
      else {
        if (pObj.ready) {
          $pRow.append($pReady);
        }
        else {
          $pRow.append($pWait);  
        }
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

        // start countdown
        startCountdown();
      }
    });
  },
  isPlayerNode = function(node) { // is this Node a player node?
    return node.hasOwnProperty('host');
  },
  getOnlinePlayers = function(snapshot) {

    connectedPlayers = [];
    snapshot.forEach(function(snap) {
      var node = snap.val();

      if (isPlayerNode(node)) { 
        connectedPlayers.push({
          id        : node.id,
          name      : node.name,
          avatar    : node.avatar,
          startTime : node.startTime,
          money     : node.money,
          ready     : node.ready,
          host      : node.host,
        });

        addConnectedPlayer({
          id    : node.id,
          name  : node.name,
          ready : node.ready,
          host  : node.host,
        });
      }
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
              ready     : false,
              host      : false,
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
      var $this = $(this);
      $('.title h1').addClass('hidden');
      $this.addClass('picked');
      playerObj.avatar = parseInt($(this).attr('data-id'));
      showDiv($('.user-form', '.login-container'));
      hideDiv($avatarBtn.not('.picked').closest('.col-lg-4'));
      $this.off('click');
    });

  },
  setAllUnready = function() {
    database.ref().once('value', function(snapshot) {
      snapshot.forEach(function(snap) {
        var node = snap.val();

        if (node.hasOwnProperty('id') && node.ready === true) {
          node.ready = false;
          YTK.db.dbUpdate(node.id, node);
        }
      });
    });
  },
  // remove user table from DB if a user disconnected
  bindDisconnect = function() {
    $(window).bind("beforeunload", function() {
      
      if (playerObj.id !== -1) {

        YTK.db.dbRemoveNode(playerObj.id);

        if (countdownInterval !== null) {
          clearInterval(countdownInterval);  
        }

        if (playerObj.ready === true) {
          YTK.db.dbRemoveNode('countdown');
          setAllUnready(); 
        }

        // end the game session if the disconnecting player is the host of the game
        // TODO: shift host when that happens
        if (playerObj.host === true) {
          YTK.db.dbRemoveNode('game');
          YTK.db.dbRemoveNode('deck');
        }
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

  showPlayersStatus = function() {
    var $status = $('.status', '.network-info');

    showDiv($status);
  },
  countDownListener = function(snapshot) {

    if (snapshot.hasChild('countdown')) { // if counter exist
      playerObj.ready = snapshot.val()[playerObj.id].ready;
      $('.start-counter').html(snapshot.val()['countdown']);
      showPlayersStatus();
    }
    else {
      playerObj.ready = false;
      $('.start-counter').html('');
    }
  },
  getHostID = function() {
    var hostID = -1;
    for (var i=0; i < connectedPlayers.length; i++) {
      if (connectedPlayers[i].host) {
        hostID = connectedPlayers[i].id;
        break;
      }
    }
    if (hostID === -1) {
      hostID = connectedPlayers[0].id;
    }
    return hostID;
  },
  gameCanStart = function() {
    return connectedPlayers.length > 1 && getHostID() >= 0;
  },
  setToHost = function() {
    playerObj.host = true;
    YTK.db.dbUpdate(playerObj.id, {host : true});
  },
  startCountdown = function() {
    database.ref().once('value', function(snapshot) {
      if (!snapshot.hasChild('countdown')) {

        setToHost();  // set this player to host

        resetStartCounter();

        // YTK.db.dbSet('countdown', startCounter);

        countdownInterval = setInterval(function() {

          YTK.db.dbSet('countdown', startCounter);

          if (startCounter === 0) {
            clearInterval(countdownInterval);
            resetStartCounter();

            YTK.db.dbRemoveNode('countdown');
            
            //double check to make sure more than 1 players are ready
            if (gameCanStart()) {
              YTK.db.dbSet('game', {
                hostID    : getHostID(),
                startTime : Date.now(),
              });
            }
          }
          else {
            startCounter --;  
          }

        }, 1000);    
      }
    });
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
  gameStartListener = function(snapshot) {
    if (!gameStarted && snapshot.hasChild('game')) {
      gameStarted = true;
      triggerGameStart();
      database.ref().off('value', loginDBListener); //turn off main login listener
    }
  },
  bindDBListener = function() {
    loginDBListener = database.ref().on('value', function(snapshot) {
      if (!gameStarted) {
        clearDiv($('.connected-players', '.login-container'));
        countDownListener(snapshot);
        getOnlinePlayers(snapshot);
        updateRdyBtn();
        gameStartListener(snapshot);
        console.log('(DB-Value, login)', snapshot.val());  
      }
    });
  },
  bindQuitBtn = function() {
    $('.connected-players').on('click', '.dc-btn', function() {
      location.reload();
    });
  },
  triggerGameStart = function(){
    $( document ).trigger("gameStarted", playerObj.id);
  },
  initLogin = function() {
    bindDisconnect();
    bindQuitBtn();

    // login page
    bindAvatarSelect();
    bindJoinBtn();
    bindReadyBtn();
    bindDCBtn();
  };

  return {
    initLogin : initLogin
  }
})();

$(function() {
  YTK.login.initLogin();
});