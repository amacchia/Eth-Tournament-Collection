// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

contract TournamentCollection {
    enum State {
        COLLECTION,
        IN_PROGRESS,
        FINISHED
    }

    uint256 public immutable tournamentFee;
    uint256 public immutable participantsAllowed;
    State public state;
    mapping(address => bool) public isInTournament;
    address public owner;
    address public winner;
    address[] private participants;

    error NotTheWinningAddress();
    error InvalidState();
    error OwnerOnlyAction();
    error InvalidTournamentFee();
    error AlreadyInTournament();
    error WinnerMustBeInTournament();

    constructor(uint256 _tournamentFee, uint256 _numberOfParticipants) {
        tournamentFee = _tournamentFee;
        participantsAllowed = _numberOfParticipants;
        state = State.COLLECTION;
        owner = msg.sender;
    }

    modifier inState(State _expectedState) {
        if (state != _expectedState) {
            revert InvalidState();
        }
        _;
    }

    modifier ownerOnly(address _address) {
        if (owner != _address) {
            revert OwnerOnlyAction();
        }
        _;
    }

    function joinTournament() public payable inState(State.COLLECTION) {
        if (msg.value != tournamentFee) {
            revert InvalidTournamentFee();
        }
        if (isInTournament[msg.sender]) {
            revert AlreadyInTournament();
        }

        isInTournament[msg.sender] = true;
        participants.push(msg.sender);
        if (participants.length == participantsAllowed) {
            state = State.IN_PROGRESS;
        }
    }

    function completeTournament(address _winner)
        public
        inState(State.IN_PROGRESS)
        ownerOnly(msg.sender)
    {
        if (!isInTournament[_winner]) {
            revert WinnerMustBeInTournament();
        }

        winner = _winner;
        state = State.FINISHED;
    }

    function withdrawWinnings() public inState(State.FINISHED) {
        if (msg.sender != winner) {
            revert NotTheWinningAddress();
        }

        uint256 winningAmount = address(this).balance;
        payable(msg.sender).transfer(winningAmount);
    }

    function participantCount() public view returns (uint256) {
        return participants.length;
    }
}
