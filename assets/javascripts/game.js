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
    seesModal         : false,  //set to true when game options/stats displayed
    givenAnte         : false,  // set to true when player makes ante for round
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

      // database.ref('/game').once('value', function(snap) {
      //   if (snap.val()['howManySeeCommunity'] === connectedPlayers.length && !stateObj.seesGameStats) {
      //     stateObj.seesGameStats = true
      //     var count = snap.val()['howManySeeGameStats'] += playerObj.id
      //     YTK.db.dbUpdate('game', {howManySeeGameStats: count})
      //     if (isHost()) {
      //       YTK.db.dbUpdate('game', {moneyOnTable: connectedPlayers.length*5})
      //     }
      //     //YTK.db.dbUpdate('game', {moneyOnTable: connectedPlayers.length*5})
      //     var btn = $("<button>")
      //     btn.html("test")
      //     $(".player-0").prepend(btn)

      if (communityReady(gameNode)) {
        var whosTurn = getWhosTurn(gameNode);

        if (!stateObj.givenAnte) {
          stateObj.givenAnte = true;
          playerMakesBet(DEFAULT_ANTE);
        }

        // this will make sure our connectedPlayer is up-to-date
        if (anteReady()) {
          updateDBPot(connectedPlayers.length * DEFAULT_ANTE);

          if (whosTurn === playerObj.id && !stateObj.seesModal) {
            stateObj.seesModal = true;
          
            setGameStatsInModal(gameNode);

            initOptionModal(displayOptionModal);
          }
        }
      }

      // notice the modal has a local timer, when it runs out it's auto "pass"

      // if a player have <= 0 money, he lose the game and can no longer do action
      // when it goes to their turn it auto pass

      // at the end of each round, updateDBDeck()
    }
  },
  anteReady = function(gameNode) {
    var allPaid = true,
        afterAnte = INIT_MONEY - DEFAULT_ANTE;

    for (var i=0; i<connectedPlayers.length; i++) {
      if (connectedPlayers[i]['money'] !== afterAnte) {
        allPaid = false;
        break;
      }
    }
    return allPaid;
  },
  updateDBPot = function(totPot) {
    YTK.db.dbUpdate('game', {totalPot :totPot});
  },
  setGameStatsInModal = function(gameNode) {
    var $statsContainer = $('.bet-form', '#optionModal'),
        othersMoney = [],
        $potDiv = $('.amount', '.pot-total');

    $potDiv.html(gameNode.totalPot);

    othersMoney = getOthersMoney(othersMoney);

    for (var i = 0; i < othersMoney.length; i++) {
      var $pDiv = $('.p-money.p-' + othersMoney[i].id, '#optionModal');
      showDiv($pDiv);
      $pDiv.find('.name').html(othersMoney[i].name);
      $pDiv.find('.amount').html(othersMoney[i].money);
    }
  },
  getOthersMoney = function(array) {
    var retVal = [];

    $.each(connectedPlayers, function(index, player) {
      if (player.id !== playerObj.id) {
        retVal.push( { id : player.id, 
                       name : player.name,
                       money : player.money,} );
      }
    });
    console.log(retVal, "HERE IS THE ARRAY YOU ARE LOOKING FOR")
    return retVal;
  },
  playerMakesBet = function(bet) {
    var count = playerObj.money;

    bet = Math.floor(bet);

    if (playerObj.money >= bet) {
      count = playerObj.money - bet;
      playerObj.money = count;
      YTK.db.dbUpdate(playerObj.id, {money: count})
    }
    else {
      console.log('%cNot enough money to make bet', 'font-weight: bold; color: red;');
    }

    // database.ref().once('value', function(snapshot) {
    //   snapshot.forEach(function(snap) {
    //     if( isPlayerNode(snap.val()) ) {
    //       if( snap.val()['id'] === playerObj.id ) {
    //         count = snap.val()['money'] - bet;
    //         YTK.db.dbUpdate(snap.val()['id'], {money: count})
    //       }
    //     }
    //   })
    // })
  }
  getWhosTurn = function(gameNode) {
    if (gameNode.hasOwnProperty('whosTurn')) {
      return parseInt(gameNode['whosTurn']);
    }
    else {
      YTK.db.dbUpdate('game', {whosTurn : connectedPlayers[0].id});
      return -1;
    }
  },
  communityReady = function(gameNode) {
    return gameNode.howManySeeCommunity === connectedPlayers.length;
  },
  displayOptionModal = function() {
    var $optModal = $('#optionModal');
    $optModal.on('shown.bs.modal', function() {
      setupLocalTimer();
    });
    $optModal.modal('show');
  },
  setupLocalTimer = function() {
    var localTimer,
        timer   = MODAL_COUNTDOWN,
        $timer  = $('.timer', '#optionModal');

    localTimer = setInterval(function() {
      if (timer === 0) {
        clearInterval(localTimer);
        console.log('times up! auto press "check"');
      }
      $timer.html(timer);
      timer --;
    }, 1000);
  },
  initOptionModal = function(callback) {
    var $optionModal = $('#optionModal'),
        $money    = $('.user-money', '#optionModal'),
        $betBtn   = $('.btn-bet', '#optionModal'),
        $checkBtn = $('.btn-check', '#optionModal'),
        $foldBtn  = $('.btn-fold', '#optionModal');

    $money.html(playerObj.money);    // update user money

    $betBtn.on('click', function() {
      console.log('just bet')
      showDiv($('.bet-amount', 'bet-form'));
    });
    callback();
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