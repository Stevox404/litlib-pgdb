const { camelToSnakeCase } = require('../utils');

module.exports.createInsertStatement = createInsertStatement;

/**
 * @param {string} table - Table to be updated
 * @param {object} fields - An object of column_name:value pairs for the query
 * @returns {{text:string, values: Array}} Generated query
 */
function createInsertStatement(table, fields = {}) {
    let query = {
        text: `INSERT INTO ${table} (`,
        values: []
    }

    let valStmt = '';
    for (let [key, val] of Object.entries(fields)) {
        if (val === undefined) continue;

        const col = camelToSnakeCase(key);
        query.values.push(val);
        const commma = addComma(query.values.length);
        query.text += `${commma} ${col}`;
        valStmt += `${commma} $${query.values.length}`;
    }

    query.text += `) VALUES (${valStmt})`;

    if (query.values.length > 0) {
        return query;
    } else {
        //No changes to be made
        return null;
    }
}



module.exports.createUpdateStatement = createUpdateStatement;

/**
 * @param {string} table - Table to be updated
 * @param {object} fields - An object of column_name:value pairs for the query
 * @param {object} condition - column_name:value pair for update condition.
 *   Only single condition currently supported. Add other conditions manually.
 * @returns {{text:string, values: Array}} Generated query
 */
function createUpdateStatement(table, fields = {}, condition) {
    let query = {
        text: `UPDATE ${table} SET`,
        values: []
    }

    for (let [key, val] of Object.entries(fields)) {
        if (val === undefined) continue;

        const col = camelToSnakeCase(key);
        query.values.push(val);
        query.text += `${addComma(query.values.length)} ${col} = $${query.values.length}`;
    }

    if (query.values.length > 0) {
        if (condition) {
            query.text += ` WHERE `;
            const conditions = Array.isArray(condition) ? condition : [condition];
            for (let i = 0, l = conditions.length; i < l; i++) {
                const condition = conditions[i];
                const { field, value, _op, _lop } = getConditionObject(condition);
                const col = camelToSnakeCase(field);
                query.values.push(value);
                query.text += `${i ? _lop : ''} ${col} ${_op} $${query.values.length}`;
            }

            function getConditionObject(cond) {
                const _op = '=', _lop = 'AND';
                if (!cond.field && !cond.value) {
                    const keys = Object.keys(cond);
                    let field;
                    for (let key of keys) {
                        // Field is the first key without an underscore
                        if (/^_/.test(keys)) continue;
                        field = key;
                        break;
                    }
                    if (keys.length > 1 && !field) {
                        console.warn(`Query condition objects should have "field" and "value" properties`);
                    }
                    field = field || keys[0];
                    const value = cond[field];
                    cond = { ...cond, field, value };
                }
                return { _op, _lop, ...cond };
            }
        }

        return query;
    } else {
        //No changes to be made
        return null;
    }
}


function addComma(len) { return len > 1 ? ', ' : '' };