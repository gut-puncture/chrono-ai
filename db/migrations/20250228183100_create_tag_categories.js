exports.up = function(knex) {
  return knex.schema.createTable('tag_categories', function(table) {
    table.increments('id').primary();
    table.string('tag_value').notNullable();
    table.enum('category_type', ['product', 'project', 'meeting']).notNullable();
    table.timestamps(true, true);
    
    // Add unique constraint on combination of tag_value and category_type
    table.unique(['tag_value', 'category_type']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('tag_categories');
};
