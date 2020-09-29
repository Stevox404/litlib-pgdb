const { Pool } = require('pg');
const url = require('url');
const qb = require('./query-builder');
require('dotenv').config();

let initializedDB;

module.exports.Db = Db;

/** 
 * @param {import("pg").PoolConfig=} newConfig 
 */
function Db(newConfig) {
    /**@type {Pool} */
    let pool, config;
    if (newConfig) {
        ({ pool, config } = init(newConfig));
    } else {
        if (!initializedDB) {
            initializedDB = init();
        }
        ({ pool, config } = initializedDB);
    }
    if (!pool || !config) {
        throw new Error('Database not initialized');
    }

    this.pool = pool;
    this.createInsertStatement = qb.createInsertStatement;
    this.createUpdateStatement = qb.createUpdateStatement;


    /**
     * Executes a database query.
     * @typedef {import('pg').QueryConfig} QueryStatement
     * @param {QueryStatement|QueryStatement[]} statement - Query to be executed.
     *   If statement is an array, a transaction is started.
     */
    this.execute = function (statement) {
        if (Array.isArray(statement)) {
            return _db_transaction(statement);
        } else {
            return pool.query(statement);
        }
    }



    /**
     * Handles a database transaction
     * @param {QueryStatement[]} statements - List of queries to be executed.
     */
    async function _db_transaction(statements) {
        const client = await pool.connect();
        await client.query('BEGIN');
        const results = [];
        try {
            for (let i = 0, l = statements.length; i < l; i++) {
                const stmt = statements[i]
                const nextStmt = statements[i + 1]

                const res = await client.query(stmt);
                results.push(res);

                // Use prev results to remove placeholders in the next query
                if (nextStmt) {
                    if (nextStmt.text) {
                        nextStmt.text = formatStatement(nextStmt.text);
                    } else {
                        statements[i + 1] = formatStatement(nextStmt);
                    }
                }
            };

            await client.query('COMMIT');
        } catch (err) {
            console.warn('Unable to complete transaction, rolling back.', err);
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        return results;


        /**
         * Queries that depend on a value from the previous query will use the placeholder '#key#'
         * Where 'key' is the column name of the required value eg. #user_id#.
         * 
         * Query example: UPDATE books SET title='New Title' WHERE author_id = #author_id#
         * 
         * @param {string} queryText - Query with placeholders
         */
        function formatStatement(queryText) {
            let formatted = queryText.replace(/(\W)#(.+?)#(?!\w)/g, (_, _m1, key) => {
                const foundVal = deepSearchKeyValue(key.toLowerCase());
                if(foundVal !== null){
                    return `${_m1}'${foundVal}'`;
                }
                return `${_m1}${foundVal}`;
            });
            return formatted;

            function deepSearchKeyValue(key) {
                for (let l = results.length, i = l - 1; i > -1; i--) {
                    const { rows } = results[i];
                    if (!rows.length) continue;
                    const idx = rows.length - 1
                    const val = rows[idx][key]; // Picks val from last result row
                    if (val !== undefined) {
                        if(typeof val === 'object' && val.constructor === Date){
                            return val.toISOString();
                        }
                        return val;
                    }
                }

                return null;
            }
        }
    }

}

Db.init = function (newConfig) {
    initializedDB = init(newConfig);
}

Db.reset = function () {
    initializedDB = undefined;
}


/** 
 * @param {import("pg").PoolConfig=} newConfig 
 */
function init(newConfig = {}) {
    let config = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        max: process.env.MAX_POOL || 20,
        idleTimeoutMillis: process.env.IDLE_TIMEOUT_MS || 60000,
        ssl: { rejectUnauthorized: false },
    };

    if (process.env.DATABASE_URL) {
        const params = url.parse(process.env.DATABASE_URL);
        const auth = params.auth.split(':');
        config = {
            ...config,
            user: auth[0],
            password: auth[1],
            host: params.hostname,
            port: params.port,
            database: params.pathname.split('/')[1],
        };
    }

    if (process.env.NODE_ENV === 'test' && process.env.DB_DATABASE_TEST) {
        config.database = process.env.DB_DATABASE_TEST;
    }

    config = {
        ...config,
        ...(newConfig.extendConfig && initializedDB && initializedDB.config),
        ...newConfig
    };


    delete config.extendConfig;

    // console.log(config);
    if (!config.user || !config.password || !config.database) {
        throw new Error(`Database improperly configured`);
    }

    const pool = new Pool(config);
    return { pool, config };
}
