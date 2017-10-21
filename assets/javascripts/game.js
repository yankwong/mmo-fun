var YTK = YTK || {} ;

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
    communityShown : -1,
    bet       : 0,
  },
  gameWinner = -1,
  gameDBListener, // used to restart a game
  seats = [], // a 1:1 matching of seat-ID : player-ID
  stateObj = {  // keep track of various state of the program
    needPreGameInit   : true,   // never reset, used in round 0
    seesModal         : false,  //set to true when #optionModal displays
    preFlopBetsMade   : false,  // set to true when all bets are in prior to flop
    firstRoundBetsMade: false, // set to true when bets are made in the first round following the flop
    canProcessModal   : true,  // set to false when we started initModal to avoid init the same modal more than once
    initTotalPot      : false, // to see if initial total pot needs to be initialized at the start of the round
    r1DeckUpdate      : false, // prevent unnecessary update of deck in DB
    r2DeckUpdate      : false,
    r3DeckUpdate      : false,
    r4DeckUpdate      : false,
    endModalShown     : false,
    processWinner     : false, // start seeing who won and give them the pot
    ultraEndModal     : false,
  },
  restarted = false,
  endOfGame = false,
  minBetHolder = 0, // for when min bet is raised through big enough bets in the round
  totalPotHolder = 0, // for updating the total pot to set in modal stats display
  turnCount = 0, //to know whose turn it is after the first turn of the round
  cardAPIFree = true, 
  connectedPlayers = [],
  database = firebase.database(),
  getNewMinBet = function(recentBet) {
    return recentBet - minBetHolder;
  },
  getNewTotalPot = function(recentBet) {
    return totalPotHolder + recentBet
  }
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
    var retVal = node.hasOwnProperty('recentBet');
    if (retVal) {
      console.log('%cBet Detected', 'font-weight: bold; color: green', node);  
    }
    return retVal;
  },
  updateDeckObj = function(obj) {
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
        
          putCard($selfHand, result.cards[i].code, i);

          var $newCard = $('#UserCard' + i);

          $newCard.flip({
            trigger: 'manual'
          });
         
          $newCard.flip(true);
          flipcard($newCard, i);
        }

        function flipcard($card, i){
          setTimeout(() => {
            $card.flip(false)
          }, 500 + (500*i));
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
          communityShown : node.communityShown,
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

  putCard = function($div, cardCode, n) {
    var $card = $('<div class="poker-card cardflip" id="UserCard' + n + '" data-cid="' + cardCode + '">');
    var $cardFront = $('<div class="front"> <img src="' + YTK.cards.getImg(cardCode) + '" class="card-img" alt="' + cardCode + '"></div>');
    var $cardBack = $('<div class="back"> <img src="https://i.pinimg.com/originals/10/80/a4/1080a4bd1a33cec92019fab5efb3995d.png" style="height:143px"></div></div>');
    $card.append($cardFront);
    $card.append($cardBack);
    $div.append($card);
  },
  updateDBDeck = function() {
    YTK.cards.getDeckStat(deckObj.id, function(result) {
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
      putCard($communityCards, result.cards[i].code, 2+i);

      // var $newCard = $('#UserCard' + (2+i));

      //     $newCard.flip({
      //       trigger: 'manual'
      //     });
         
      //     $newCard.flip(true);
      //     flipcard($newCard, i);

    }
    // function flipcard($card, i){
    //   setTimeout(() => {
    //     $card.flip(false)
    //   }, 500 + (500*i));
    // }

    playerObj.community = JSON.stringify(communityArray);
    playerObj.communityShown = communityArray.length - 2;
  },
  putFakeCards = function($div, total) {    
    for (var i=0; i<total; i++) {
      var $fakeCard = $('<div class="poker-card"><img src="assets/images/card-face-down.png" class="fake-card"></div>');
      $div.append($fakeCard);
    }
  },
  assignSeats = function() {
    console.log('%cAssign seats', 'font-weight:bold; color: green;');
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
  updatePlayerStat = function(pObj) {
    var seatID = seats.indexOf(pObj.id),
      $seat = $('.seat.player-' + seatID);

    $seat.find('.money').html('<i class="fa fa-usd" aria-hidden="true"></i>' + pObj.money);
  },
  // main function to determine what to do in each round
  gameRoundListener = function(snapshot) {
    var gameNode = snapshot.val()['game'],
        dbGameRound = getDBGameRound(gameNode);

    // update 'preFlopBetsMade' with firebase data
    stateObj.preFlopBetsMade = gameNode.preFlopBetsMade;

    // Handle end game, could happen at ANY round
    if (gameNode.doneTransfer && !stateObj.endModalShown) {
      stateObj.endModalShown = true; 

      if (gameWinner == -1) {
        if (gameNode.round < 3) {
          gameWinner = playerObj.id;
        }
        else {
          gameWinner = checkWhoWon();
        }  
      }
      initEndGameModal(gameWinner, function() {
        $('#endModal').modal({backdrop: 'static', keyboard: false});
      });

      setTimeout( function() {
        $('#endModal').modal('hide');
        restartGame(false);
      }, ENDGAME_RESULT_TIMER);   
    }

    else {

      if (endOfGame) {
        if (!restarted && !stateObj.ultraEndModal) {
          stateObj.ultraEndModal = true;

          // setup ultraEndModal
          $('#restart').off().on('click', function() {
            
            $('#finalEndModal').modal('hide');
            
            restarted = true;
            // restartGame(true);
            database.ref('/game/restarters/'+(playerObj.id+1)).set({restart : true})
          });

          // before displaying, make sure it's already hidden
          if (!($("#finalEndModal").data('bs.modal') || {})._isShown ) {
            displayEndModal();  
          }
        }
        
        var count = 0
        if (gameNode.hasOwnProperty('restarters')) {
          $.each(gameNode.restarters, function(key, value) {
              count += key
          })
        }
        if (count === 3) { // only work for two players
          endOfGame = false
          restartGame(true);
        }
      }
      // ROUND 0
      if (dbGameRound === 0 && !endOfGame) {
        console.log('%c--- ROUND '+dbGameRound+' ---', 'font-weight: bold; color: gold');


        // Pre-Game Phrase (ONCE)
        if (stateObj.needPreGameInit && deckObj.id !== '') {

          stateObj.needPreGameInit = false;
          hideDiv($('.page-loader'));

          if (seats.length === 0) {
            assignSeats();
          }

          // update all players stat (except player 0 for now)
          for (var i=1; i<seats.length; i++) {
            var player = connectedPlayers[seats[i]];
            putPlayerStat(player);
          }  

          // deal the two cards which each user will see face up
          if (deckObj.id !== '' && cardAPIFree) {
            cardAPIFree = false;
            console.log('%cDrawing 2 cards...', 'font-weight:bold; color: blue;', playerObj);
            YTK.cards.drawCards(deckObj.id, 2, function(result) {
              initialDraw(result);
            });      
          }

          // put two fake cards on table
          for (var i=1; i < connectedPlayers.length; i++) {
            putFakeCards($('.seat.player-' + i), 2);
          }  
        }
        
        // Bidding Phrase (MULTIPLE)
        if (haveHand(playerObj) && !stateObj.preFlopBetsMade) {

          // turnCount start at 0, player 0 will always start first
          if (isMyTurn() && !stateObj.seesModal) { 
            stateObj.seesModal = true;
            initOptionModal(gameNode, displayOptionModal);
          }
          // when someone (including urself) makes a bet
          // signal turn switch
          else if (betHasBeenMade(gameNode)) {
            
            // close modal + reset min bet, pot, some stateObj flags
            postBetBookkeeping(gameNode);
            
            // show your modal if it's your turn
            if (isMyTurn() && stateObj.canProcessModal) {
              stateObj.canProcessModal = false;
              database.ref('/game/recentBet').remove().then(function() {
                initOptionModal(gameNode, displayOptionModal);  
              });
            }
          }
        }
        // Prep Phrase (Host: ONCE, Other: 1+)
        else if (haveHand(playerObj) && stateObj.preFlopBetsMade) {
          
          minBetHolder = 0;   // reset minBetHolder
          turnCount = 0;      // reset turnCount before the start of next turn

          // HOST: draw commuinty card 
          if (isHost() && cardAPIFree) {
            cardAPIFree = false;
            YTK.cards.drawCards(deckObj.id, 3, function(result) {
              communityDraw(result);

              // go to round 1
              YTK.db.dbUpdate('game', {communityHand : result, howManySeeGameStats : 0, round: 1, preFlopBetsMade: false}, function() {
                stateObj.preFlopBetsMade = false;  // reset database "preFlopBetsMade"
                YTK.db.dbUpdate(playerObj.id, {communityShown: 1, bet : 0});
              });
            });
          }        
        }
      }
      // ROUND 1: first deal of the commuinty deck
      else if (dbGameRound === 1 && !endOfGame) {
        console.log('%c--- ROUND '+dbGameRound+' ---', 'font-weight: bold; color: gold');

        // Draw Phrase (ONCE)
        if (isHost()) {
          if (!stateObj.r1DeckUpdate) {
            stateObj.r1DeckUpdate = true;
            updateDBDeck(); //update deck data in firebase, no drawing 
          }
        }
        else {
          if (!stateObj.r1DeckUpdate) {
            if (!communityShownOnRound(dbGameRound) && gameNode.hasOwnProperty('communityHand')) {
              communityDraw(gameNode['communityHand']);
              
              YTK.db.dbUpdate(playerObj.id, {communityShown: dbGameRound, bet : 0});
            }
            if (communityShownOnRound(dbGameRound)) {
              stateObj.r1DeckUpdate = true;
              grabCommunityCards()
            }
          }
        }

        // Bidding Phase (MULTIPLE)
        if (stateObj.r1DeckUpdate && communityReady(dbGameRound)) {

          cardAPIFree = true; // done with cardAPI, reset state

          if (!stateObj.preFlopBetsMade) {
            grabCommunityCards()
            if (isMyTurn() && !stateObj.seesModal) {
              stateObj.seesModal = true;
              initOptionModal(gameNode, displayOptionModal);
            }

            // someone made a bet
            else if (betHasBeenMade(gameNode)) {
              
              // close modal + reset min bet, pot, some stateObj flags
              postBetBookkeeping(gameNode);

              // show your modal if it's your turn
              if (isMyTurn() && stateObj.canProcessModal) {
                stateObj.canProcessModal = false;
                database.ref('/game/recentBet').remove().then(function() {
                  initOptionModal(gameNode, displayOptionModal); 
                });
              }
            }
          }
          // Prep Phrase (Host: ONCE, Other: 1+)
          else if (stateObj.preFlopBetsMade) {
            
            minBetHolder = 0;
            turnCount = 0;

            // reset communityShown for everybody
            if (isHost()) {
              handleFlop(gameNode);
            }        
          }
        }
      }
      // ROUND II | round 2
      else if (dbGameRound === 2 && !endOfGame) {
        console.log('%c--- ROUND '+dbGameRound+' ---', 'font-weight: bold; color: gold');
        
        // Draw Phrase (ONCE)
        if (isHost()) {
          if (!stateObj.r2DeckUpdate) {
            stateObj.r2DeckUpdate = true;
            updateDBDeck(); //update deck data in firebase, no drawing 
          }
        }
        else {
          if (!stateObj.r2DeckUpdate) {
            if (!communityShownOnRound(dbGameRound) && gameNode.hasOwnProperty('communityHand')) {
              communityDraw(gameNode['communityHand']);
              
              YTK.db.dbUpdate(playerObj.id, {communityShown: dbGameRound, bet : 0});
            }
            if (communityShownOnRound(dbGameRound)) {
              stateObj.r2DeckUpdate = true;
              grabCommunityCards();
            }
          }
        } 

        // Bidding Phrase (MULTIPLE)
        if (stateObj.r2DeckUpdate && communityReady(dbGameRound)) {
          cardAPIFree = true;
          
          if (!stateObj.preFlopBetsMade) {
            
            if (isMyTurn() && !stateObj.seesModal) {
              stateObj.seesModal = true;
              initOptionModal(gameNode, displayOptionModal);
            }
            // someone made a bid
            else if (betHasBeenMade(gameNode)) {

              // close modal + reset min bet, pot, some stateObj flags
              postBetBookkeeping(gameNode);
              
              // show your modal if it's your turn
              if (isMyTurn() && stateObj.canProcessModal) {
                stateObj.canProcessModal = false;
                database.ref('/game/recentBet').remove().then(function() {
                  initOptionModal(gameNode, displayOptionModal);  
                });
              }
            }
          }
          // ready to increament round
          else if (stateObj.preFlopBetsMade) {
            turnCount = 0;
            minBetHolder = 0;

            if (isHost()) {
              handleFlop(gameNode);
            }
          }
        }
      }

      // ROUND III, END GAME!!!
      else if (dbGameRound === 3 && !endOfGame) {
        console.log('%c--- END GAME ---', 'font-weight: bold; color: gold');

        // Draw Phrase (ONCE)
        if (isHost()) {
          if (!stateObj.r3DeckUpdate) {
            stateObj.r3DeckUpdate = true;
            updateDBDeck(); //update deck data in firebase, no drawing 
          }
        }
        else {
          if (!stateObj.r3DeckUpdate) {
            if (!communityShownOnRound(dbGameRound) && gameNode.hasOwnProperty('communityHand')) {
              communityDraw(gameNode['communityHand']);
              
              YTK.db.dbUpdate(playerObj.id, {communityShown: dbGameRound, bet : 0});
            }
            if (communityShownOnRound(dbGameRound)) {
              stateObj.r3DeckUpdate = true;
              grabCommunityCards();
            }
          }
        } 

        // natural game end, we need to compare poker rank
        if (stateObj.r3DeckUpdate && communityReady(dbGameRound)) {

          if (isHost() && !stateObj.processWinner) {
            stateObj.processWinner = true;
            gameWinner = checkWhoWon();
            transferPotToWinner(gameWinner);
          }
          
        }
      }
    }
  },
  postBetBookkeeping = function(gameNode) {
    minBetHolder = getNewMinBet(gameNode.recentBet);
    totalPotHolder = getNewTotalPot(gameNode.recentBet);               
    updateTurnCount();
    hideOptionModal();
    stateObj.canProcessModal = true;
    stateObj.seesModal = false;

    for (var i=1; i<seats.length; i++) {
      var player = connectedPlayers[seats[i]];
      if (player.id !== playerObj.id) {
        updatePlayerStat(player);  
      }
    }  
  },
  getCommunityDraws = function() {
    var $cCards = $('.poker-card', '.game-container .community-area'),
        retArr = [];

    $.each($cCards, function(index, card) {
      retArr.push($(card).attr('data-cid'));
    });
    return retArr;
  },

  checkWhoWon = function() {
    var solvedArray       = [],
        uniquePlayerCard  = [],
        rankArray         = [],
        totalCards, cardSolved, result,
        winnerCards = [],
        communityCardsArr = getCommunityDraws();

    $.each(connectedPlayers, function(index, player) {
      var playerHand = JSON.parse(player.hand);
          
      uniquePlayerCard[player.id] = [];

      for (var num=0; num<2; num++) {

        var translatedCard = playerHand[num].replace('0', '10').toLowerCase();

        if (translatedCard.indexOf('10') !== -1) {
          uniquePlayerCard[player.id].push('10');
        }
        else {
          uniquePlayerCard[player.id].push(translatedCard);
        }
      }

      // combine players hand with community draws
      totalCards = communityCardsArr.concat(playerHand);
      // translate 0 to 10
      totalCards = totalCards.map(function(x) {
        return x.replace('0', '10');
      });
      
      if (totalCards.length > 0) {
        solvedArray.push(Hand.solve(totalCards));
      }
    });

    // solve it with pokerSolver
    if (solvedArray.length > 0) {

      var result = Hand.winners(solvedArray);
      // parse result
      $.each(result[0].cardPool, function(index, card) {
        winnerCards.push((card.value + card.suit).toLowerCase());
      });

      console.log('%c---Poker Rank Comparison---', 'font-weight: bold; color: red;');

      for (var i=0; i<connectedPlayers.length; i++) {
        if (winnerCards.indexOf(uniquePlayerCard[i][0]) > -1 && 
            winnerCards.indexOf(uniquePlayerCard[i][1]) > -1) {
          console.log('%cWinner: player '+i, 'font-weight: bold; color: purple;');
          return i;
        }
      }
    }
    return 0; // catch all
  },
  resetStateObj = function() {
    stateObj = {
      needPreGameInit   : true,   // never reset, used in round 0
      seesModal         : false,  //set to true when #optionModal displays
      preFlopBetsMade   : false,  // set to true when all bets are in prior to flop
      firstRoundBetsMade: false, // set to true when bets are made in the first round following the flop
      canProcessModal   : true,  // set to false when we started initModal to avoid init the same modal more than once
      initTotalPot      : false, // to see if initial total pot needs to be initialized at the start of the round
      r1DeckUpdate      : false, // prevent unnecessary update of deck in DB
      r2DeckUpdate      : false,
      r3DeckUpdate      : false,
      r4DeckUpdate      : false,
      endModalShown     : false,
      processWinner     : false, // start seeing who won and give them the pot
      ultraEndModal     : false,
    };
  },
  transferPotToWinner = function(winnerID){
    YTK.db.dbUpdate(winnerID, {money : connectedPlayers[winnerID].money + totalPotHolder}, function() {
      YTK.db.dbUpdate('game', {doneTransfer : true });
    });
  },
  initEndGameModal = function(winnerID, callback) {
    var endModal = '#endModal';
    var endAllGame = false;

    for (var i = 0; i < connectedPlayers.length; i++) {
      if (connectedPlayers[i].money === 0) {
        endAllGame = true;
      }
    }

    if (endAllGame) {
      endOfGame = true;
      $('.modal-title', endModal).html("GAME OVER!!!!!");
    } else {
      $('.modal-title', endModal).html("Round Over!");
    }

    $('.summary .name', endModal).html(connectedPlayers[winnerID].name);
    $.each(connectedPlayers, function(index, player){
      var pDiv = '.p' + player.id;

      showDiv($(pDiv));

      if (playerObj.id === player.id) {
        $(pDiv, endModal).find('.name').html('<b>YOU</b>');  
      }
      else {
        $(pDiv, endModal).find('.name').html(player.name);  
      }
      $(pDiv, endModal).find('.money').html(player.money);
    });

    callback();
  },
  resetPlayerMoney = function() {
    // true end game: reset local connectedPlayers
    for (var i = 0; i < connectedPlayers.length; i++) {
      connectedPlayers[i].money = INIT_MONEY;
    }
  },
  restartGame = function(endGame) {
    // clean up community cards from html and database
    $('.community-area', '.game-container').html();
    $('.poker-card', '.game-container').remove();
    database.ref().off('value', gameDBListener);

    // reset local variables
    turnCount       = 0;
    cardAPIFree     = true;
    gameWinner      = -1;
    totalPotHolder  = 0;
    minBetHolder    = 0;
    connectedPlayers = [];

    var playUpdateObj = endGame == true ? {hand : '', bet : 0, money : INIT_MONEY, communityShown : -1} : {hand : '', bet : 0, communityShown : -1};    


    if (isHost()) {
      database.ref('/game').child('communityHand').remove().then(function() {
        database.ref('/game').child('recentBet').remove().then(function() {
          YTK.db.dbUpdate('game', {doneTransfer : false}, function() {
            YTK.db.dbUpdate(playerObj.id, playUpdateObj, function() {
              resetStateObj();
              if (endGame) {
                // doestn' work because whiel the 2nd player is updating 
                // their DB player node the local connectedPlayer get updated
                resetPlayerMoney(); 
              }
              initGame(playerObj.id);
            });
          });
        });
      });
    }
    else {
      showDiv($('.page-loader'));
      setTimeout(function() {
        YTK.db.dbUpdate(playerObj.id, playUpdateObj, function() {
          resetStateObj();
          if (endGame) {
            resetPlayerMoney();
          }
          initGame(playerObj.id);            
        });
      }, ENDGAME_RESULT_TIMER);  
    }
  },
  communityShownOnRound = function(round) {
    return playerObj.communityShown === round;
  },
  
  // 1. draw card from cardAPI 
  // 2. update firebase with newly drawn community card
  // 3. update firebase with round ++
  handleFlop = function(gameNode) {
    var totalDraw = 0,
        upcomingRound = gameNode.round + 1;

console.log('%cHandle Flop Called', 'font-weight: bold; color: blue;');

    if (gameNode.round === 0) {
      totalDraw = 3;
    }
    else if (gameNode.round > 0 && gameNode.round < 3) {
      totalDraw = 1;
    }

    if (cardAPIFree) {
      cardAPIFree = false;
      YTK.cards.drawCards(deckObj.id, totalDraw, function(result) {
        communityDraw(result);
        YTK.db.dbUpdate('game', {communityHand : result, howManySeeGameStats : 0, preFlopBetsMade: false, round : upcomingRound}, function() {
          YTK.db.dbUpdate(playerObj.id, {communityShown : upcomingRound, bet : 0});
        });
      });
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
    var othersMoney = [],
        $potDiv = $('.amount', '.pot-total');
        $callAmt = $('.btn-call .amount', '#optionModal'),

    $potDiv.html(totalPotHolder);
    $callAmt.html(minBetHolder);

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
  playerMakesBet = function(bet, checkBtnEnd) {
    var count = playerObj.money;
        bet = Math.floor(bet);

    checkBtnEnd = checkBtnEnd || false;

    playerObj.bet = playerObj.bet || 0;

    if (playerObj.money >= bet && bet >= MIN_BET) {
      count = playerObj.money - bet;
      playerObj.money = count;

      console.log('%cPlayer '+ playerObj.id + ' Making a bet ($' + bet+')','font-weight: bold; color: red;');

      YTK.db.dbUpdate(playerObj.id, {money: count, bet: playerObj.bet + bet}, function() {
        YTK.db.dbUpdate('game', {recentBet : bet}, function() {
          if (checkBtnEnd) {
            YTK.db.dbUpdate('game', {preFlopBetsMade: true});
          }
        });  
      });
    }
    else if (!(playerObj.money) >= bet && bet >= MIN_BET) {
      console.log('%cNot enough money to make bet', 'font-weight: bold; color: red;');
    }
    else if (playerObj.money >= bet && !(bet >= MIN_BET) ) {
      console.log('%cNeed to make bigger bet', 'font-weight: bold; color: red;')
    }
  },
  communityReady = function(round) {
    var retVal = true;

    for (var i = 0; i < connectedPlayers.length; i++) {
      if (connectedPlayers[i].communityShown !== round) {
        retVal = false;
        break;
      }
    }
    return retVal;
  },
  displayOptionModal = function() {
    var $optModal = $('#optionModal');
    $optModal.modal({backdrop: 'static', keyboard: false});  
  },
  displayEndModal = function() {
    var $endModal = $('#finalEndModal')
    $endModal.modal({backdrop: 'static', keyboard: false});
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
    if (minBetHolder === 0) {
      var allEqual = true;
    } 
    else {
      var allEqual = false;
    }
    return allEqual; 
  },
  grabCommunityCards = function() {
    var $communityArea = $('.community-area', '.game-container'),
        $modalCCards   = $('.community-cards', '#optionModal'),
        communityCards = $communityArea.html();

    if (communityCards !== '') {
      $modalCCards.html($communityArea.html())  
    }
  },
  initOptionModal = function(gameNode, callback) {
    var $optionModal = $('#optionModal'),
        $money    = $('.user-money .amount', '#optionModal'),
        $betBtn   = $('.btn-makeBet', '#optionModal'),
        $checkBtn = $('.btn-check', '#optionModal'),
        $callBtn = $('.btn-call', '#optionModal'),
        $foldBtn  = $('.btn-fold', '#optionModal'),
        $minBet   = $('.min-bet', '#optionModal'),
        $betTxtBox = $('.bet-amount', '#optionModal'),
        myBet = playerObj.bet || 0;

    setGameStatsInModal(gameNode);
    grabCommunityCards();
    $money.html(playerObj.money);  // update user money
    $minBet.html('Minimum Bet: ' + minBetHolder);
    $betTxtBox.val('');
    
    // for the very first turn of each round
    if (turnCount === 0) {
      hideDiv($callBtn);
      showDiv($checkBtn)
      $betBtn.html('Initial Bet');
    }
    else {
      if (canCheck()) {
        showDiv($checkBtn);
        hideDiv($callBtn)
      }
      else {
        showDiv($callBtn);  
        hideDiv($checkBtn)
      }      
      $betBtn.html('Raise');
    }

    // setup "check" button
    // case 1: last player on quene clicked: end turn
    if (turnCount !== 0 && whosTurn() === connectedPlayers.length - 1) {
      $checkBtn.off().on('click', function() {
        
        // close modal
        hideOptionModal();
        stateObj.seesModal = false;

        stateObj.preFlopBetsMade = true;
        YTK.db.dbUpdate('game', {preFlopBetsMade: true});
      });
    }
    else {
      $checkBtn.off().on('click', function() {
        playerMakesBet(minBetHolder);  // trigger modal exchange
      })
    }

    // setup "fold" button, only works if there are 2 players left
    if (playersLeftInGame() === 2) {
      $foldBtn.off().on('click', function() {
        hideOptionModal();
        stateObj.seesModal = false;
        
        // transfer pot to "the other player"
        for (var i = 0; i < connectedPlayers.length; i++) {
          if (connectedPlayers[i].id !== playerObj.id) {
            gameWinner = connectedPlayers[i].id;
            transferPotToWinner(connectedPlayers[i].id);    
          }
        }

      });
    }

    // setup "bet" ("raise") button
    $betBtn.off().on('click', function() {
      var bet = Math.floor(parseInt($('.bet-amount').val())) + minBetHolder;
      if (Number.isInteger(bet) && bet > 0) {
        playerMakesBet(bet); // update Firebase \player's Node  
      }
      
    });
    $('.bet-amount', '#optionModal').off().on('keyup', function(e) {
      if (e.keyCode == 13) {
        var bet = Math.floor(parseInt($('.bet-amount').val())) + minBetHolder;
        if (Number.isInteger(bet) && bet > 0) {
          playerMakesBet(bet); // update Firebase \player's Node
        }
      }
    });
    
    // setup the "call" button
    if (turnCount !== 0 && whosTurn() === connectedPlayers.length - 1) {
      $callBtn.off().on('click', function() {
        
        hideOptionModal();
        stateObj.seesModal = false;

        // normal round: handle bet first, set preFlopBetsMade last 
        if (gameNode.round !== 2) {
          playerMakesBet(minBetHolder, true);  
        }
        // last round: set preFlopBetsMade first, handle bet last
        else {
          YTK.db.dbUpdate('game', {preFlopBetsMade: true}, function() {
            playerMakesBet(minBetHolder);  
          });
        }
        
        
        
      });
    } else {
      $callBtn.off().on('click', function() {
        playerMakesBet(minBetHolder); /// should trigger modal exchange when it is player id 0 only
      });
    }

    callback();
  },
  playersLeftInGame = function() {
    return connectedPlayers.length;
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
    gameDBListener = database.ref().on('value', function(snapshot) {
      console.log('%c(DB-Value, game)', 'color: silver;', snapshot.val());

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