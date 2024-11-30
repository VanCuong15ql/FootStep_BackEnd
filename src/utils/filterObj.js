const filterObj = (obj, ...allowedFields) => {
    const newObj = {};
    Object.keys(obj).forEach((el) => {
        if (allowedFields.includes(el) && obj[el] !== null && obj[el] !== undefined && obj[el])   
            newObj[el] = obj[el];
    });
    return newObj;
}

module.exports = filterObj;