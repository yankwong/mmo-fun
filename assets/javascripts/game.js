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
    bet       : 0,
  }, 
  seats = [], // a 1:1 matching of seat-ID : player-ID
  stateObj = {  // keep track of various state of the program
    canPutFakeCard    : true,   // never reset
    communityDrawFree : true,   // reset
    canAssignSeat     : true,   // reset
    needPlayersStats  : true,   // never reset
    seesModal         : false,  //set to true when #optionModal displays
    givenAnte         : false,  // set to true when player makes ante for round
    allDecisionsSatisfied: false,  // to be used to justify the instance of the subsequent round
    preFlopBetsMade   : false,  // set to true when all bets are in prior to flop
    firstRoundBetsMade: false, // set to true when bets are made in the first round following the flop
  },
  minBetHolder = 0, // for when min bet is raised through big enough bets in the round
  turnCount = 0, //to know whose turn it is after the first turn of the round
  cardAPIFree = true, 
  connectedPlayers = [],
  database = firebase.database(),
  getLarger = function (numA, numB) {
    numA = parseInt(numA);
    numB = parseInt(numB);
    return numA >= numB ? numA : numB;
  },
  showDiv = function($div) {
    $div.removeClass('hidden'); 
  },
  hideDiv = function($div) {
    $div.addClass('hidden');
  },
  isPlayerNode = function(node) { // is this Node a player node?
    return node.hasOwnProperty('host');
  },
  betHasBeenMade = function(node) { // did this player make a bet?
    return node.hasOwnProperty('recentBet')
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
  updatePlayerObj = function(newObj) {
    $.extend(playerObj, newObj);
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
          bet       : node.bet,
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
    updatePlayerObj(connectedPlayers[playerObj.id])
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

      // update 'preFlopBetsMade' with firebase data
      stateObj.preFlopBetsMade = gameNode.preFlopBetsMade;

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
      
      // deal the two cards which each user will see face up
      if (!haveHand(playerObj)) {
        if (deckObj.id !== '' && cardAPIFree) {
          cardAPIFree = false;
          console.log('> drawing 2 cards...', playerObj);
          YTK.cards.drawCards(deckObj.id, 2, function(result) {
            initialDraw(result);
          });      
        }
      }
      // FOR THE BETS BEFORE THE COMMUNITY CARD FLOP 
      else if (!stateObj.preFlopBetsMade) {
        // put two fake cards on table
        if (stateObj.canPutFakeCard) {
          stateObj.canPutFakeCard = false;
          for (var i=1; i < connectedPlayers.length; i++) {
            putFakeCards($('.seat.player-' + i), 2);
          }  
        }
        // turnCount start at 0, player 0 will always start first
        if (isMyTurn() && !stateObj.seesModal) {
          stateObj.seesModal = true;
          setGameStatsInModal(gameNode);
          initOptionModal(gameNode, displayOptionModal);
        }
        // when someone (including urself) makes a bet
        else if (betHasBeenMade(gameNode)) {
          minBetHolder = getLarger(gameNode.recentBet, minBetHolder);
          updateTurnCount();
          hideOptionModal();
          stateObj.seesModal = false;
          
          // show your modal if it's your turn
          if (isMyTurn()) {
            database.ref('/game/recentBet').remove().then(function() {
              setGameStatsInModal(gameNode);
              initOptionModal(gameNode, displayOptionModal);  
            });
          }
        }
      }
      // AFTER THE PREFLOP BETS ARE IN, WE MUST DRAW THE COMMUNITY CARDS, STARTING WITH THE HOST
      else if (stateObj.preFlopBetsMade) {

        // HOST: draw commuinty card 
        if (isHost() && cardAPIFree) {
          cardAPIFree = false;
          YTK.cards.drawCards(deckObj.id, 3, function(result) {
            communityDraw(result);
            YTK.db.dbUpdate('game', {communityHand : result, howManySeeCommunity : 1, howManySeeGameStats : 0})
          });
        }

        // go to round 1
        YTK.db.dbUpdate('game', {round : 1});
      }
    }
    // ROUND 1: first deal of the commuinty deck
    else if (dbGameRound === 1) {
      console.log('%c--- ROUND 1 ---', 'font-weight: bold; color: gold');

      if (isHost()) {
        updateDBDeck();
      } 
      else {
        console.log('round1:', stateObj.communityDrawFree)
        if (!playerObj.communityShown && stateObj.communityDrawFree) {

          stateObj.communityDrawFree = false;
     
          if (gameNode.hasOwnProperty('communityHand')) {
            communityDraw(gameNode['communityHand']);
            var count = gameNode['howManySeeCommunity'] + connectedPlayers.length - 1
            YTK.db.dbUpdate('game', {howManySeeCommunity : count})
          }
          stateObj.communityDrawFree = true;
        }
      }


      if (communityReady(gameNode)) {
        var whosTurn = getWhosTurn(gameNode);

        if (!stateObj.givenAnte) {
          stateObj.givenAnte = true;
          playerMakesBet(DEFAULT_ANTE);
        }

        // this will make sure our connectedPlayer is up-to-date
        if (anteReady()) {
          console.log(connectedPlayers, "!!!!!!!!!!!!!!!!!!!!!!$$$$$$$$$$$$$$$$$$$$$$$")
          if (!stateObj.firstRoundBetsMade) {
            stateObj.firstRoundBetsMade = true;
            updateDBPot(connectedPlayers.length * DEFAULT_ANTE);
          }
          //this will bring the modal to the host player one the flop has been completed for all players
          if (whosTurn === playerObj.id && !stateObj.seesModal) {
            stateObj.seesModal = true;
            setGameStatsInModal(gameNode);
            initOptionModal(gameNode, displayOptionModal);
          }
        }
      }
      // for the player bets that aren't the host
      if (betHasBeenMade(gameNode)) {
        // turnCount++
        updateTurnCount();
        hideOptionModal();
        if (playerObj.id === turnCount) {
          setGameStatsinModal(gameNode)
          initOptionModal(gameNode, displayOptionModal)
        }
      }
      // if a player have <= 0 money, he lose the game and can no longer do action
      // when it goes to their turn it auto pass

      // at the end of each round, updateDBDeck()
    }
  },
  whosTurn = function() {
    return turnCount % connectedPlayers.length;
  },
  isMyTurn = function() {
    return playerObj.id === whosTurn();
  },
  updateTurnCount = function() {
    turnCount++;
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
    if (gameNode.hasOwnProperty('totalPot')) {
      $potDiv.html(gameNode.totalPot);
    } else {
      $potDiv.html('0')
    }
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
    return retVal;
  },
  playerMakesBet = function(bet) {
    var count = playerObj.money;
        bet = Math.floor(bet);

    playerObj.bet = playerObj.bet || 0;

    if (playerObj.money >= bet && bet >= MIN_BET) {
      count = playerObj.money - bet;
      playerObj.money = count;

      YTK.db.dbUpdate(playerObj.id, {money: count, bet: playerObj.bet + bet}, function() {
        YTK.db.dbUpdate('game', {recentBet : bet});  
      });
    }
    else if (!(playerObj.money) >= bet && bet >= MIN_BET) {
      console.log('%cNot enough money to make bet', 'font-weight: bold; color: red;');
    }
    else if (playerObj.money >= bet && !(bet >= MIN_BET)) {
      console.log('%cNeed to make bigger bet', 'font-weight: bold; color: red;')
    }
  },
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
      //setupLocalTimer();
    });
    $optModal.modal('show');
  },
  hideOptionModal = function() {
    var $optModal = $('#optionModal');
    $optModal.modal('hide');
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
  canCheck = function() {
    var myBet = playerObj.bet,
        allEqual = true;
console.log('can check?', connectedPlayers);
    for (var i = 0; i<connectedPlayers.length; i++) {
      if (myBet !== connectedPlayers[i].bet) {
        console.log('this fucker', connectedPlayers[i]);
        allEqual = false;
        break;
      }
    }
    return allEqual;
  };
  initOptionModal = function(gameNode, callback) {
    var $optionModal = $('#optionModal'),
        $money    = $('.user-money .amount', '#optionModal'),
        $betBtn   = $('.btn-makeBet', '#optionModal'),
        $checkBtn = $('.btn-check', '#optionModal'),
        $callBtn = $('.btn-call', '#optionModal'),
        $callAmt = $('.btn-call .amount', '#optionModal'),
        $foldBtn  = $('.btn-fold', '#optionModal'),
        $minBet   = $('.min-bet', '#optionModal'),
        $betTxtBox = $('.bet-amount', '#optionModal'),
        myBet = playerObj.bet || 0;


    $money.html(playerObj.money);  // update user money
    $minBet.html('Minimum Bet: ' + minBetHolder);
    $betTxtBox.val('');

    // for the very first turn
    if (turnCount === 0) {
      hideDiv($callBtn);
      hideDiv($checkBtn);
    }
    else {
      if (canCheck()) {
        showDiv($checkBtn);
      }
      else {
        showDiv($callBtn);  
      }
      $callAmt.html(minBetHolder - myBet);
      $betBtn.html('Raise');  // change wording of the bet button
    }

    // setup "check" button
    if (turnCount !== 0 && whosTurn() === 0) {
      $checkBtn.off().on('click', function() {

        database.ref('/game/recentBet').remove();
        stateObj.preFlopBetsMade = true;
        turnCount = 0;
        database.ref('/game').update({preFlopBetsMade: true})

        console.log('done with pre flop');
      });
    }
    else {
      $checkBtn.off().on('click', function() {
        playerMakesBet(0);  // calling this just to trigger modal exchange
      })
    }

    // setup "bet" ("raise") button
    $betBtn.off().on('click', function() {
      var bet = Math.floor(parseInt($('.bet-amount').val()));
      playerMakesBet(bet); // update Firebase \player's Node
    });
    $('.bet-amount', '#optionModal').off().on('keyup', function(e) {
      if (e.keyCode == 13) {
        var bet = Math.floor(parseInt($('.bet-amount').val()));
        playerMakesBet(bet); // update Firebase \player's Node
      }
    });
    
    // setup the "call" button
    $callBtn.off().on('click', function() {
      playerMakesBet(minBetHolder);
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