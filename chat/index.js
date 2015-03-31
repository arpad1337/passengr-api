/*
 * @author Árpád Kiss
 * @copyright Passengr.me
 */

var redis = require('redis');

var noop = function() {};

module.exports = (function() {
	var _io;
	var _client;
	var _onConnect = function(socket) {
		console.log('Partner connected: ' + socket.id);
		socket.emit('connected');
		socket.on('login', _onLogin);
		socket.on('next', _onNext);
		socket.on('message', _onMessage);
		socket.on('logout', _onLogout);
		socket.on('disconnect', _onDisconnect);
		_subscriber.subscribe(socket.id);
	};
	var _onLogout = function() {
		var socket = this;
		_removeUserFromLobby(socket.id, noop);
		_partnerLeft(socket);
		console.log('user [' + this.id + '] logged out.');
	};
	var _partnerLeft = function(socket, cb) {
		_client.hget('user_' + socket.id, 'partner', function(err, partnerId) {
			if (err) {
				console.error('Chat: there is no partner at the moment.');
				return;
			}
			if (partnerId) {
				_client.hset('user_' + socket.id, 'partner', false);
				_publisher.publish(partnerId, JSON.stringify({
					event: 'partnerLeft'
				}));
				if(cb && typeof cb === 'function') {
					cb();
				}
			}
		});
	};
	var _onDisconnect = function() {
		console.log('user [' + this.id + '] disconnected.');
		_removeUserFromLobby(this.id, noop);
		_partnerLeft(this, function(){
			_client.del('user_' + this.id, noop);
		});
		delete _io.sockets.connected[this.id];
	};
	var _onLogin = function(data) {
		var socket = this;

		console.log(data);

		if (!data || !data.age || !data.gender) {
			console.error('Chat: Missing login cretentials: age or gender.');
			return;
		}

		var currentCredentials = {
			age: data.age,
			gender: data.gender
		};

		_client.hset('user_' + socket.id, 'credentials', JSON.stringify(currentCredentials));
		_client.llen('lobby', function(err, length) {
			if (err) {
				console.error(err);
				return;
			}
			if (length > 0) {
				_client.lrange('lobby', 0, -1, function(err, list) {
					console.log(list);
					if (err) {
						console.error(err);
						return;
					}
					var partnerId = false;
					for (var i = 0; i < list.length; i++) {
						if (list[i] != socket.id) {
							partnerId = list[i];
							break;
						}
					}
					if (partnerId) {
						_removeUserFromLobby(partnerId, function() {
							console.log('user [' + partnerId + '] removed from lobby for: ' + socket.id);
							_createSession(socket, currentCredentials, partnerId);
						});
						return;
					}
					_addUserToLobby(socket.id);
				});
				return;
			}
			_addUserToLobby(socket.id);
		});
	};
	var _addUserToLobby = function(id) {
		_client.hget('user_' + id, 'inLobby', function(err, inLobby) {
			if (err) {
				console.error(err);
				return;
			}
			console.log(arguments);
			if (!inLobby || inLobby === 'false') {
				console.log('user [' + id + '] added to lobby');
				_client.hset('user_' + id, 'partner', false);
				_client.hset('user_' + id, 'inLobby', true);
				_client.lpush('lobby', id, noop);
				_io.sockets.connected[id].emit('inLobby');
			}
		});
	};
	var _removeUserFromLobby = function(id, cb) {
		_client.hset('user_' + id, 'inLobby', false);
		_client.lrem('lobby', 0, id, function(err, result) {
			cb();
		});
	};
	var _createSession = function(socket, credentials, partnerId) {
		_client.hget('user_' + partnerId, 'credentials', function(err, data) {
			if (err) {
				console.error(err);
				return;
			}
			data = JSON.parse(data);
			console.log('Partner found: ' + data.age + '/' + data.gender);
			socket.emit('newPartnerFound', data);
			_client.hset('user_' + socket.id, 'partner', partnerId);
			_publisher.publish(partnerId, JSON.stringify({
				event: 'newPartnerFound',
				data: {
					credentials: credentials,
					id: socket.id
				}
			}));
		});
	};
	var _onNext = function() {
		var socket = this;
		_nextPartner(this);
		_partnerLeft(this);
	};
	var _nextPartner = function(socket) {
		_client.hget('user_' + socket.id, 'credentials', function(err, data) {
			if (err) {
				console.error(err);
				return;
			}
			data = JSON.parse(data);
			_onLogin.call(socket, data);
		});
	};
	var _onMessage = function(message) {
		_client.hget('user_' + this.id, 'partner', function(err, partnerId) {
			_publisher.publish(partnerId, JSON.stringify({
				event: 'message',
				data: message
			}));
		});
	};
	var _onRedisMessage = function(channel, message) {
		var socket = _io.sockets.connected[channel];
		if (!socket) {
			console.error('Chat: socket not found.');
			return;
		}
		message = JSON.parse(message);
		switch (message.event) {
			case "newPartnerFound":
				_client.hset('user_' + channel, 'partner', message.data.id);
				console.log('Partner found: ' + message.data.credentials.age + '/' + message.data.credentials.gender);
				socket.emit('newPartnerFound', message.data.credentials);
				break;
			case "partnerLeft":
				_nextPartner(socket);
				socket.emit('partnerLeft');
				break;
			case "message":
				socket.emit('message', message.data);
				break;
		}
	};
	return {
		init: function(io) {
			_io = io;
			_publisher = redis.createClient();
			_subscriber = redis.createClient();
			_client = redis.createClient();
			_client.del('lobby');
			_subscriber.on('message', _onRedisMessage);
			_io.on('connection', _onConnect);
			console.log('IO launched.');
		}
	};
})();