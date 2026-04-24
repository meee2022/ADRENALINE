import { db } from './db';
import * as schema from '@shared/schema';
import { format, addDays } from 'date-fns';

async function seed() {
  console.log('Seeding database...');

  // Seed meal categories
  const categories = await Promise.all([
    db.insert(schema.mealCategories).values({ name: 'إفطار', sortOrder: 1 }).returning(),
    db.insert(schema.mealCategories).values({ name: 'سناك 1', sortOrder: 2 }).returning(),
    db.insert(schema.mealCategories).values({ name: 'غداء', sortOrder: 3 }).returning(),
    db.insert(schema.mealCategories).values({ name: 'سناك 2', sortOrder: 4 }).returning(),
    db.insert(schema.mealCategories).values({ name: 'عشاء', sortOrder: 5 }).returning(),
    db.insert(schema.mealCategories).values({ name: 'وجبة 4', sortOrder: 6 }).returning(),
  ]);

  console.log('Created categories:', categories.length);

  // Seed menu items
  const menuItems = await Promise.all([
    db.insert(schema.menuItems).values({ name: 'شوفان وتوت', categoryId: categories[0][0].id, isActive: true, calories: 350 }).returning(),
    db.insert(schema.menuItems).values({ name: 'بيض وتوست', categoryId: categories[0][0].id, isActive: true, calories: 400 }).returning(),
    db.insert(schema.menuItems).values({ name: 'مخفوق بروتين', categoryId: categories[1][0].id, isActive: true, calories: 150 }).returning(),
    db.insert(schema.menuItems).values({ name: 'سلطة دجاج مشوي', categoryId: categories[2][0].id, isActive: true, calories: 500 }).returning(),
    db.insert(schema.menuItems).values({ name: 'وعاء لحم مع أرز', categoryId: categories[2][0].id, isActive: true, calories: 600 }).returning(),
    db.insert(schema.menuItems).values({ name: 'تفاح وزبدة فول سوداني', categoryId: categories[3][0].id, isActive: true, calories: 200 }).returning(),
    db.insert(schema.menuItems).values({ name: 'سلمون وهليون', categoryId: categories[4][0].id, isActive: true, calories: 550 }).returning(),
    db.insert(schema.menuItems).values({ name: 'كرات لحم ديك رومي', categoryId: categories[4][0].id, isActive: true, calories: 450 }).returning(),
  ]);

  console.log('Created menu items:', menuItems.length);

  // Seed addons (price in cents)
  const addons = await Promise.all([
    db.insert(schema.addons).values({ name: 'بروتين إضافي', price: 200, isActive: true }).returning(),
    db.insert(schema.addons).values({ name: 'أفوكادو', price: 150, isActive: true }).returning(),
    db.insert(schema.addons).values({ name: 'مكسرات', price: 100, isActive: true }).returning(),
  ]);

  console.log('Created addons:', addons.length);

  // Seed customers
  const customers = await Promise.all([
    db.insert(schema.customers).values({
      fullName: 'أحمد محمد',
      phone: '1234567890',
      gender: 'MALE',
      deliveryTime: 'MORNING',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      isActive: true,
      address: 'شارع الرياضة 123، شقة 4ب',
      goals: 'زيادة عضلات',
    }).returning(),
    db.insert(schema.customers).values({
      fullName: 'سارة علي',
      phone: '9876543210',
      gender: 'FEMALE',
      deliveryTime: 'EVENING',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      isActive: true,
      address: '456 شارع اللياقة',
      goals: 'خسارة دهون',
      allergies: 'فول سوداني',
    }).returning(),
  ]);

  console.log('Created customers:', customers.length);

  // Seed daily plans
  const today = format(new Date(), 'yyyy-MM-dd');
  const plans = await Promise.all([
    db.insert(schema.dailyPlans).values({
      date: today,
      customerId: customers[0][0].id,
      deliveryTime: 'MORNING',
      status: 'CONFIRMED',
      items: [
        { id: 'pi1', categoryId: categories[0][0].id, menuItemId: menuItems[0][0].id, isOff: false, addonIds: [] },
        { id: 'pi2', categoryId: categories[2][0].id, menuItemId: menuItems[3][0].id, isOff: false, addonIds: [addons[0][0].id] },
        { id: 'pi3', categoryId: categories[4][0].id, menuItemId: menuItems[6][0].id, isOff: false, addonIds: [] },
      ],
    }).returning(),
    db.insert(schema.dailyPlans).values({
      date: today,
      customerId: customers[1][0].id,
      deliveryTime: 'EVENING',
      status: 'PREPARED',
      items: [
        { id: 'pi4', categoryId: categories[0][0].id, menuItemId: menuItems[1][0].id, isOff: false, addonIds: [] },
        { id: 'pi5', categoryId: categories[2][0].id, menuItemId: menuItems[4][0].id, isOff: false, addonIds: [] },
        { id: 'pi6', categoryId: categories[4][0].id, menuItemId: menuItems[7][0].id, isOff: false, addonIds: [addons[1][0].id] },
      ],
    }).returning(),
  ]);

  console.log('Created daily plans:', plans.length);

  console.log('Seeding completed!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
