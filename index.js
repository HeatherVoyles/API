var express = require('express');
var bodyParser = require('body-parser');
var expressValidator = require('express-validator');
var multer  = require('multer');

var app = express();

app.use(bodyParser.json({ type: 'application/json' }));
app.use(expressValidator());
app.set('views', './views');
app.set('view engine', 'ejs');

var postgres = require('./lib/postgres');

function lookupPhoto(req, res, next) {
    var photoId = req.params.id;
    var sql = 'SELECT * FROM photo WHERE id = $1';
    postgres.client.query(sql, [ photoId ], function(err, results) {
        if (err) {
            console.error(err);
            res.statusCode = 500;
            return res.json({ errors: ['Could not retrieve photo'] });
        }
        if (results.rows.length === 0) {
            res.statusCode = 404;
            return res.json({ errors: ['Photo not found']});
        }

        req.photo = results.rows[0];
        next();
    });
}

function validatePhoto(req, res, next) {
    if (!req.files.photo) {
        res.statusCode = 400;
        return res.json({
            errors: ['File failed to upload']
        });
    }
    if (req.files.photo.truncated) {
        res.statusCode = 400;
        return res.json({
            errors: ['File too large']
        });
    }

    req.checkBody('description', 'Invalid description').notEmpty();
    req.checkBody('album_id', 'Invalid album_id').isNumeric();

    var errors = req.validationErrors();
    if (errors) {
        var response = { errors: [] };
        errors.forEach(function(err) {
            response.errors.push(err.msg);
        });

        res.statusCode = 400;
        return res.json(response);
    }

    return next();
}

app.post('/dispatch', function(req, res) {
    if (req.body.fname === null || req.body.fname === undefined) {
        return res.json({'status': 'error', 'message': 'Please Enter Your First Name'});
    }
    else if (req.body.lname === null || req.body.lname === undefined) {
        return res.json({'status': 'error', 'message': 'Please Enter Your Last Name'});
    }
    else if (req.body.phone === null || req.body.phone === undefined) {
        return res.json({'status': 'error', 'message': 'Please Enter Your Digits'});
    }
    else if (req.body.address === null || req.body.address === undefined) {
        return res.json({'status': 'error', 'message': 'Please Enter Your Address'});
    }
    else if (req.body.postalcode === null || req.body.postalcode === undefined) {
        return res.json({'status': 'error', 'message': 'Please Enter Your Postal Code'});
    }

    else if (req.body.email === null || req.body.email === undefined) {
        return res.json({'status': 'error', 'message': 'Please Input Email Address For Notifications'});
    }

    else if (req.body.plowtype === null || req.body.plowtype === undefined) {
        return res.json({'status': 'error', 'message': 'Please Select Desired Plow Type'});
    }


    else if (req.body.plowtime === null || req.body.plowtime === undefined) {
        return res.json({'status': 'error', 'message': 'Please Specify Desired Time'});
    }

    else {
        var sql = 'INSERT INTO dispatch (fname, lname, phone, address, postalcode, plowtype, notes, email) VALUES ($1,$2,$3,$4,$5,$6,$7, $8) RETURNING id';
        var data = [
            req.body.fname,
            req.body.lname,
            req.body.phone,
            req.body.address,
            req.body.postalcode,
            req.body.plowtype,
            req.body.notes,
            req.body.email
        ];
        postgres.client.query(sql, data, function (err, result) {
            if (err) {
                console.error(err);
                res.statusCode = 500;
                return res.json({
                    errors: ['Could Not Dispatch']
                });
            }
            if (result.rows.length > 0) {
                return res.json({'status': 'Success. Fist Bump.'});
            }
        });
    }
})


var photoRouter = express.Router();

photoRouter.get('/', function(req, res) {
    var page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) {
        page = 1;
    }

    var limit = parseInt(req.query.limit, 10);
    if (isNaN(limit)) {
        limit = 10;
    } else if (limit > 50) {
        limit = 50;
    } else if (limit < 1) {
        limit = 1;
    }

    var sql = 'SELECT count(1) FROM photo';
    postgres.client.query(sql, function(err, result) {
        if (err) {
            console.error(err);
            res.statusCode = 500;
            return res.json({
                errors: ['Could not retrieve photos']
            });
        }

        var count = parseInt(result.rows[0].count, 10);
        var offset = (page - 1) * limit;

        sql = 'SELECT * FROM photo OFFSET $1 LIMIT $2';
        postgres.client.query(sql, [offset, limit], function(err, result) {
            if (err) {
                console.error(err);
                res.statusCode = 500;
                return res.json({
                    errors: ['Could not retrieve photos']
                });
            }

            return res.json(result.rows);
        });
    });
});

photoRouter.post('/', multer({
    dest: './uploads/',
    rename: function(field, filename) {
        filename = filename.replace(/\W+/g, '-').toLowerCase();
        return filename + '_' + Date.now();
    },
    limits: {
        files: 1,
        fileSize: 2 * 1024 * 1024,
    }
}), validatePhoto, function(req, res) {
    var sql = 'INSERT INTO photo (description, filepath, album_id) VALUES ($1,$2,$3) RETURNING id';
    var data = [
        req.body.description,
        req.files.photo.path,
        req.body.album_id
    ];
    postgres.client.query(sql, data, function(err, result) {
        if (err) {
            console.error(err);
            res.statusCode = 500;
            return res.json({
                errors: ['Could not create photo']
            });
        }

        var photoId = result.rows[0].id;
        var sql = 'SELECT * FROM photo WHERE id = $1';
        postgres.client.query(sql, [ photoId ], function(err, result) {
            if (err) {
                console.error(err);
                res.statusCode = 500;
                return res.json({ errors: ['Could not retrieve photo after create'] });
            }

            res.statusCode = 201;
            res.json(result.rows[0]);
        });
    });
});
photoRouter.get('/:id([0-9]+)', lookupPhoto, function(req, res) {
    res.json(req.photo);
});
photoRouter.patch('/:id([0-9]+)', function(req, res) { });
app.use('/photo', photoRouter);

var uploadRouter = express.Router();
uploadRouter.get('/', function(req, res) {
    res.render('form');
});
app.use('/upload', uploadRouter);

module.exports = app;
