
module.exports.snakeToCamelCase = function (val) {
    return changeCase(val);
}

module.exports.camelToSnakeCase = function (val) {
    return changeCase(val, { toSnake: true });
}

function changeCase(val, { toSnake, } = {}) {
    if (!val) return val;
    if (Array.isArray(val)) {
        return val.reduce((acc, elm) => {
            if (!elm) return acc;
            if (typeof elm === 'object') {
                return [...acc, changeCase(elm, { toSnake })]
            }

            return [...acc, elm]
        }, []);
    }
    if (val.constructor === Object) {
        const newObj = {}
        Object.keys(val).forEach(key => {
            if (typeof val[key] === 'object') {
                return newObj[changeCase(key, { toSnake })] = changeCase(val[key], { toSnake });
            }
            newObj[changeCase(key, { toSnake })] = val[key];
        });
        return newObj;
    }

    if (typeof val === 'string') {
        if (toSnake) {
            return val.replace(/([A-Z])/g, (match, p1) => ('_' + p1.toLowerCase()));
        } else {
            return val.replace(/\_([a-zA-Z0-9])/g, (match, p1) => p1.toUpperCase());
        }
    }

    return val;
}