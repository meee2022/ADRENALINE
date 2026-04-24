// Test parsing logic
const testFiles = [
  "Adrenaline Halloumi Muffin مافن الحلوم.jpg",
  "Avocado Crab Sandwich  شطيرة الأفوكادو والسلطعون.jpg",
  "Beef Alfredo ألفريدو اللحم البقري.jpg"
];

function parseName(basename: string) {
  // Find the first Arabic character
  const arabicMatch = basename.match(/[\u0600-\u06FF]/);
  
  let nameEn: string;
  let nameAr: string;
  
  if (arabicMatch && arabicMatch.index !== undefined) {
    // Find the last space before the Arabic text starts
    const beforeArabic = basename.substring(0, arabicMatch.index);
    const lastSpaceIndex = beforeArabic.lastIndexOf(' ');
    
    if (lastSpaceIndex > 0) {
      nameEn = basename.substring(0, lastSpaceIndex).trim();
      nameAr = basename.substring(lastSpaceIndex + 1).trim();
    } else {
      // No space found, use the whole string
      nameEn = basename.trim();
      nameAr = basename.trim();
    }
  } else {
    // No Arabic found
    nameEn = basename.trim();
    nameAr = basename.trim();
  }
  
  return { nameEn, nameAr };
}

console.log("Testing name parsing:\n");

testFiles.forEach(file => {
  const basename = file.replace(/\.(jpg|jpeg|png)$/i, '');
  const { nameEn, nameAr } = parseName(basename);
  
  console.log(`File: ${file}`);
  console.log(`  EN: ${nameEn}`);
  console.log(`  AR: ${nameAr}`);
  console.log('');
});
