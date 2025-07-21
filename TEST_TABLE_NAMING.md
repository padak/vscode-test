# 🧪 Test Guide: Configurable Table Naming Feature

## 📋 **Feature Overview**
Version 2.8.0 introduces configurable table naming for exports. Users can now choose between:
- **Full names**: `in.c-data.weather.csv` (default, existing behavior)
- **Short names**: `weather.csv` (new option)

Directory structure remains the same for context: `workspace/kbc_project/in/c-data/weather.csv`

## 🔧 **How to Test**

### **Step 1: Access Settings**
1. Open VS Code with the Keboola extension
2. Click the Keboola icon in the Activity Bar
3. Click "⚙️ Settings" at the top of the panel

### **Step 2: Configure Table Naming**
1. Scroll to "📤 Export Settings" section
2. Find the new checkbox: **"Use short table names (e.g., "weather.csv" instead of "in.c-data.weather.csv")"**
3. **Test Case A**: Leave unchecked (default behavior)
4. **Test Case B**: Check the box (new short names)
5. Click "💾 Save Export Settings"

### **Step 3: Verify Settings Display**
After saving, you should see success message with table naming preference:
- `Export settings saved! Folder: "kbc_project", Limit: 2,000, Headers: included, Table names: full names`
- `Export settings saved! Folder: "kbc_project", Limit: 2,000, Headers: included, Table names: short names`

### **Step 4: Check Detail Panels**
1. Navigate to any table, bucket, or stage
2. Open the detail panel
3. Look for "📏 Current Settings" section
4. Verify "Table names: **Full**" or "Table names: **Short**" displays correctly

### **Step 5: Test Export Behavior**

#### **Test Case A: Full Names (Default)**
1. Set "Use short table names" to **OFF**
2. Export a table (e.g., `in.c-data.weather`)
3. **Expected filename**: `in.c-data.weather.csv`
4. **Expected path**: `workspace/kbc_project/in/c-data/in.c-data.weather.csv`

#### **Test Case B: Short Names (New Feature)**
1. Set "Use short table names" to **ON**
2. Export the same table (`in.c-data.weather`)
3. **Expected filename**: `weather.csv`
4. **Expected path**: `workspace/kbc_project/in/c-data/weather.csv`

## 🎯 **Expected Results**

### **Setting Persistence**
- ✅ Setting should persist between VS Code sessions
- ✅ Setting is stored per connection in global state
- ✅ Default value is `false` (maintains existing behavior)

### **UI Consistency**
- ✅ All detail panels show current naming setting
- ✅ Settings panel provides clear checkbox with example
- ✅ Save confirmation includes naming preference

### **Export Behavior**
- ✅ Directory structure unchanged (provides context)
- ✅ Full names: Complete table ID as filename
- ✅ Short names: Only table name as filename (extracted from full ID)

## 🔍 **Filename Extraction Logic**

The `extractTableName()` function extracts clean names:
- `in.c-data.weather` → `weather`
- `out.c-main.users` → `users`
- `in.c-crm.customer_data` → `customer_data`

## 🚨 **Edge Cases to Test**

1. **Complex table names**: `in.c-data.weather.forecast.daily`
   - Short: `weather.forecast.daily.csv`
   - Full: `in.c-data.weather.forecast.daily.csv`

2. **Single-part names**: `weather` (if somehow they exist)
   - Short: `weather.csv`
   - Full: `weather.csv` (same)

3. **Special characters**: Table names with underscores, hyphens
   - Should be preserved in short names

## ✅ **Success Criteria**

- [ ] Settings UI shows new checkbox with clear explanation
- [ ] Default behavior unchanged (full names)
- [ ] Short names option works correctly
- [ ] Setting persists across sessions
- [ ] All detail panels show current setting
- [ ] Directory structure remains logical
- [ ] No breaking changes to existing functionality

---

**🎉 Ready to test the new configurable table naming feature!** 