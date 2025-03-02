exports.up = function(knex) {
  return knex.schema.alterTable('ChatMessage', function(table) {
    table.jsonb('tags').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('ChatMessage', function(table) {
    table.dropColumn('tags');
  });
};
