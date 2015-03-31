/*
 * GET home page.
 */

module.exports = (function() {
	return {
		index: function(req, res) {
			res.render('index', {
				title: 'Naive Passengr client'
			});
		},
		upload: function(req, res) {
			if (!req.files.image && (req.files.image.type == "image/png" || req.files.image.type == "image/jpeg")) {
				res.end('Nope...');
				return;
			}
			var parts = req.files.image.path.split('/');
			parts.shift();
			res.end(parts.join('/'));
		}
	};
})();