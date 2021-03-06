var sqlite3 = require("sqlite3");
var Query   = require("sql-query").Query;

exports.Driver = Driver;

function Driver(config, connection, opts) {
	this.config = config || {};
	this.opts   = opts || {};
	this.query  = new Query("sqlite");

	if (connection) {
		this.db = connection;
	} else {
		// on Windows, paths have a drive letter which is parsed by
		// url.parse() has the hostname. If host is defined, assume
		// it's the drive letter and add ":"
		this.db = new sqlite3.Database(((config.host ? config.host + ":" : "") + (config.pathname || "")) || ':memory:');
	}
}

Driver.prototype.sync = function (opts, cb) {
	return require("../DDL/sqlite").sync(this, opts, cb);
};

Driver.prototype.drop = function (opts, cb) {
	return require("../DDL/sqlite").drop(this, opts, cb);
};

Driver.prototype.ping = function (cb) {
	process.nextTick(cb);
	return this;
};

Driver.prototype.on = function (ev, cb) {
	if (ev == "error") {
		this.db.on("error", cb);
	}
	return this;
};

Driver.prototype.connect = function (cb) {
	process.nextTick(cb);
};

Driver.prototype.close = function (cb) {
	this.db.close();
	if (typeof cb == "function") process.nextTick(cb);
};

Driver.prototype.find = function (fields, table, conditions, opts, cb) {
	var q = this.query.select()
	                  .from(table).select(fields);

	if (opts.offset) {
		q.offset(opts.offset);
	}
	if (typeof opts.limit == "number") {
		q.limit(opts.limit);
	} else if (opts.offset) {
		// OFFSET cannot be used without LIMIT so we use the biggest INTEGER number possible
		q.limit('9223372036854775807');
	}
	if (opts.order) {
		q.order(opts.order[0], opts.order[1]);
	}

	if (opts.merge) {
		q.from(opts.merge.from.table, opts.merge.from.field, opts.merge.to.field);
		if (opts.merge.where && Object.keys(opts.merge.where[1]).length) {
			q = q.where(opts.merge.where[0], opts.merge.where[1], conditions).build();
		} else {
			q = q.where(conditions).build();
		}
	} else {
		q = q.where(conditions).build();
	}

	if (this.opts.debug) {
		require("../../Debug").sql('sqlite', q);
	}
	this.db.all(q, cb);
};

Driver.prototype.count = function (table, conditions, cb) {
	var q = this.query.select()
	                  .from(table)
	                  .count(null, 'c')
	                  .where(conditions)
	                  .build();

	if (this.opts.debug) {
		require("../../Debug").sql('sqlite', q);
	}
	this.db.all(q, cb);
};

Driver.prototype.insert = function (table, data, id_prop, cb) {
	var q = this.query.insert()
	                  .into(table)
	                  .set(data)
	                  .build();

	if (this.opts.debug) {
		require("../../Debug").sql('sqlite', q);
	}
	this.db.all(q, function (err, info) {
		if (err) {
			return cb(err);
		}
		this.db.get("SELECT last_insert_rowid() AS last_row_id", function (err, row) {
			if (err) {
				return cb(err);
			}
			return cb(null, {
				id: row.last_row_id
			});
		});
	}.bind(this));
};

Driver.prototype.update = function (table, changes, conditions, cb) {
	var q = this.query.update()
	                  .into(table)
	                  .set(changes)
	                  .where(conditions)
	                  .build();

	if (this.opts.debug) {
		require("../../Debug").sql('sqlite', q);
	}
	this.db.all(q, cb);
};

Driver.prototype.remove = function (table, conditions, cb) {
	var q = this.query.remove()
	                  .from(table)
	                  .where(conditions)
	                  .build();

	if (this.opts.debug) {
		require("../../Debug").sql('sqlite', q);
	}
	this.db.all(q, cb);
};

Driver.prototype.clear = function (table, cb) {
	var query = "DELETE FROM " + this.query.escapeId(table);

	if (this.opts.debug) {
		require("../../Debug").sql('sqlite', query);
	}
	this.db.all(query, cb);
};
