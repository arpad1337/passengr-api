var Client = (function($, IO){
	var _socket;
	var _container;
	var _loggedIn = false;
	var _onSubmit = function(e) {
		e.preventDefault();
		var t = $("textarea[name=message]");
		var msg = t.val();
		_socket.emit('message', msg);
		t.val('');
		t.trigger('focus');
		_appendMessage({
			type: 'own',
			message: msg
		});
	};
	var _onLogin = function() {
		_loggedIn = true;
		_socket.emit('login', {
			age: $('input[name=age]').val(),
			gender: $('select[name=gender] option:selected').val()
		});
	};
	var _onLogout = function() {
		_loggedIn = false;
		_socket.emit('logout');
	};
	var _onNewPartnerFound = function(data) {
		console.log(arguments);
		_appendMessage({
			type: 'notification',
			message: 'Partner found: ' + data.age + '/' + data.gender
		});
	};
	var _onPartnerLeft = function() {
		if(!_loggedIn) {
			return;
		}
		console.log(arguments);
		_appendMessage({
			type: 'notification',
			message: 'Partner left.'
		});
	};
	var _onMessage = function(message) {
		console.log(arguments);
		_appendMessage({
			type: 'partner',
			message: message
		});
	};
	var _clear = function() {
		_container.html("");
		_appendMessage({
			type: 'notification',
			message: 'Waiting for partner to connect...'
		});
	};
	var _onNext = function() {
		_clear();
		_socket.emit('next');
	};
	var _appendMessage = function(data) {
		var el = $("<p>").addClass(data.type);
		el.html(data.message);
		_container.append(el);
	};
	return {
		init: function() {
			console.log('Client init...');
			_socket = IO('ws://prod.passengr.me/');
			_socket.on('newPartnerFound', _onNewPartnerFound);
			_socket.on('partnerLeft', _onPartnerLeft);
			_socket.on('message', _onMessage);
			_socket.on('inLobby', _clear);
			_container = $("#chat-area");
			$("#login").on('click', _onLogin);
			$("#logout").on('click', _onLogout);
			$("#next").on('click', _onNext);
			$("#chat").on('submit', _onSubmit);
		}
	};
})(jQuery, io);

$(document).ready(Client.init);