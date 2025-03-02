const knex = require('../db/knex');

class TagService {
  static async processMessageTags(tags) {
    if (!tags) return;
    
    const categories = ['product', 'project', 'meeting'];
    const promises = [];

    for (const category of categories) {
      if (tags[category]) {
        // Ensure array format
        const tagValues = Array.isArray(tags[category]) ? tags[category] : [tags[category]];
        
        for (const value of tagValues) {
          promises.push(
            knex('tag_categories')
              .insert({
                tag_value: value,
                category_type: category
              })
              .onConflict(['tag_value', 'category_type'])
              .ignore()
          );
        }
      }
    }

    await Promise.all(promises);
    return tags;
  }

  static async getAllTagsByCategory(category) {
    return knex('tag_categories')
      .where('category_type', category)
      .select('tag_value');
  }
}

module.exports = TagService;
