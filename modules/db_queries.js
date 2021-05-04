const dict_sample = (RES_filters) => `-- Dict sample
SELECT
  dict_sample.*
FROM dict_sample
${RES_filters.FINALLY}
ORDER BY dict_sample.id
`;
const dict_sample_recordset = (RES_filters) => `-- Dict sample
SELECT
  dict_sample.*
FROM dict_sample
${RES_filters.FINALLY}
ORDER BY dict_sample.id
;
SELECT
  dict_sample.*
FROM dict_sample
${RES_filters.FINALLY}
ORDER BY dict_sample.id DESC
`;

module.exports = {
    v0: {
        'dict_sample': (RES_filters) => dict_sample(RES_filters),
        'dict_sample_recordset': (RES_filters) => dict_sample_recordset(RES_filters),
    },
}