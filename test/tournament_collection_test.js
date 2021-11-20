const TournamentCollection = artifacts.require("TournamentCollection");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("TournamentCollection", function (accounts) {

  const TOURNAMENT_FEE = 100;
  const NUMBER_OF_PARTICIPANTS = 10;
  const COLLECTION_STATE = '0';
  const IN_PROGRESS_STATE = '1';
  const FINISHED_STATE = '2';

  let contract;
  let errorMessage;

  beforeEach(async function () {
    contract = await TournamentCollection.new(TOURNAMENT_FEE, NUMBER_OF_PARTICIPANTS);
    errorMessage = '';
  });

  it("should create contract", async function () {
    assert.equal(TOURNAMENT_FEE, await contract.tournamentFee.call());
    assert.equal(NUMBER_OF_PARTICIPANTS, await contract.participantsAllowed.call());
    assert.equal(COLLECTION_STATE, await contract.state.call());
    assert.equal(accounts[0], await contract.owner.call());
  });

  it("should add participant", async function () {
    let account = accounts[0];

    await contract.joinTournament({ from: account, value: 100 });
    let count = await contract.participantCount.call();

    assert.equal(1, count.toNumber());
    assert.isTrue(await contract.isInTournament.call(account));
    assert.equal(COLLECTION_STATE, await contract.state.call());
  });

  it("should reject participant if value is less than tournament fee", async function () {
    let account = accounts[0];

    try {
      await contract.joinTournament({ from: account, value: TOURNAMENT_FEE - 1 });
    } catch (error) {
      errorMessage = error.message;
    }

    assert.include(errorMessage, "revert");
    assert.equal(0, await contract.participantCount.call());
  });

  it("should reject participant if value is greater than tournament fee", async function () {
    let account = accounts[0];

    try {
      await contract.joinTournament({ from: account, value: TOURNAMENT_FEE + 1 });
    } catch (error) {
      errorMessage = error.message;
    }

    assert.include(errorMessage, "revert");
    assert.equal(0, await contract.participantCount.call());
  });

  it("should reject participant if tournament is full", async function () {
    let account1 = accounts[0];
    let account2 = accounts[1];
    let account3 = accounts[2];
    let participantsAllowed = 2;
    contract = await TournamentCollection.new(TOURNAMENT_FEE, participantsAllowed);
    await contract.joinTournament({ from: account1, value: TOURNAMENT_FEE });
    await contract.joinTournament({ from: account2, value: TOURNAMENT_FEE });

    try {
      await contract.joinTournament({ from: account3, value: TOURNAMENT_FEE });
    } catch (error) {
      errorMessage = error.message;
    }

    assert.include(errorMessage, "revert");
    assert.equal(2, await contract.participantCount.call());
  });

  it("should reject participant if sender is already in tournament", async function () {
    let account1 = accounts[0];
    await contract.joinTournament({ from: account1, value: TOURNAMENT_FEE });

    try {
      await contract.joinTournament({ from: account1, value: TOURNAMENT_FEE });
    } catch (error) {
      errorMessage = error.message;
    }

    assert.include(errorMessage, "revert");
  });

  it("should begin tournament", async function () {
    let account1 = accounts[0];
    let account2 = accounts[1];
    let participantsAllowed = 2;
    contract = await TournamentCollection.new(TOURNAMENT_FEE, participantsAllowed);

    await contract.joinTournament({ from: account1, value: TOURNAMENT_FEE });
    await contract.joinTournament({ from: account2, value: TOURNAMENT_FEE });

    assert.equal(IN_PROGRESS_STATE, await contract.state.call());
  });

  it("should reject finish request if winner is not in tournament", async function () {
    let account1 = accounts[0];
    let account2 = accounts[1];
    let account3 = accounts[2];
    let participantsAllowed = 2;
    contract = await TournamentCollection.new(TOURNAMENT_FEE, participantsAllowed);
    await contract.joinTournament({ from: account1, value: TOURNAMENT_FEE });
    await contract.joinTournament({ from: account2, value: TOURNAMENT_FEE });

    try {
      await contract.completeTournament(account3);
    } catch (error) {
      errorMessage = error.message;
    }

    assert.include(errorMessage, "revert");
    assert.equal(IN_PROGRESS_STATE, await contract.state.call());
  });

  it("should reject finish request if tournament is not in progress", async function () {
    let account = accounts[0];
    await contract.joinTournament({ from: account, value: TOURNAMENT_FEE });

    try {
      await contract.completeTournament(account);
    } catch (error) {
      errorMessage = error.message;
    }

    assert.include(errorMessage, "revert");
    assert.equal(COLLECTION_STATE, await contract.state.call());
  });

  it("should only allow owner to complete tournament", async function () {
    let account1 = accounts[0];
    let account2 = accounts[1];
    let participantsAllowed = 2;
    contract = await TournamentCollection.new(TOURNAMENT_FEE, participantsAllowed);
    await contract.joinTournament({ from: account1, value: TOURNAMENT_FEE });
    await contract.joinTournament({ from: account2, value: TOURNAMENT_FEE });

    try {
      await contract.completeTournament(account2, { from: account2 });
    } catch (error) {
      errorMessage = error.message;
    }

    assert.include(errorMessage, "revert");
    assert.equal(IN_PROGRESS_STATE, await contract.state.call());
  });

  it("should declare winner", async function () {
    let account1 = accounts[0];
    let account2 = accounts[1];
    let participantsAllowed = 2;
    contract = await TournamentCollection.new(TOURNAMENT_FEE, participantsAllowed);
    await contract.joinTournament({ from: account1, value: TOURNAMENT_FEE });
    await contract.joinTournament({ from: account2, value: TOURNAMENT_FEE });

    await contract.completeTournament(account1);

    assert.equal(FINISHED_STATE, await contract.state.call());
    assert.equal(account1, await contract.winner.call());
  });

  it("should allow winner to withdraw prize", async function () {
    let TOURNAMENT_FEE = '1000000000000000000';
    let account1 = accounts[4];
    let account2 = accounts[5];
    let startingBalance = await web3.eth.getBalance(account1);
    contract = await TournamentCollection.new(TOURNAMENT_FEE, 2);
    await contract.joinTournament({ from: account1, value: TOURNAMENT_FEE });
    await contract.joinTournament({ from: account2, value: TOURNAMENT_FEE });
    await contract.completeTournament(account1);

    await contract.withdrawWinnings({ from: account1 });
    let winnerBalance = await web3.eth.getBalance(account1);

    assert.isAbove(winnerBalance - startingBalance, 0);
  });

  it("should not allow loser to withdraw prize", async function () {
    let account1 = accounts[0];
    let account2 = accounts[1];
    contract = await TournamentCollection.new(TOURNAMENT_FEE, 2);
    await contract.joinTournament({ from: account1, value: TOURNAMENT_FEE });
    await contract.joinTournament({ from: account2, value: TOURNAMENT_FEE });
    await contract.completeTournament(account1);

    try {
      await contract.withdrawWinnings({ from: account2 });
    } catch (error) {
      errorMessage = error.message;
    }

    assert.include(errorMessage, 'revert');
  });

  it("should not allow withdraw if tournament is not finished", async function () {
    let account = accounts[0];

    try {
      await contract.withdrawWinnings({ from: account });
    } catch (error) {
      errorMessage = error.message;
    }

    assert.include(errorMessage, 'revert');
  });
});
