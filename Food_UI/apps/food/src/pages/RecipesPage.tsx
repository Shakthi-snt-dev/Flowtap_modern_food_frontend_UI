import React, { useState } from 'react'
import { Plus, Eye, Trash2, ChefHat } from 'lucide-react'
import { Button, Modal, Input, Select, Badge } from '@flowtap/ui-core'
import toast from 'react-hot-toast'

interface RecipeIngredient {
  name: string
  qty: string
  cost: number
}

interface Recipe {
  id: string
  name: string
  category: string
  yield: string
  costPerPortion: number
  ingredients: RecipeIngredient[]
}

const MOCK_RECIPES: Recipe[] = [
  {
    id: '1', name: 'Butter Chicken', category: 'Main Course', yield: '1 portion', costPerPortion: 120,
    ingredients: [{ name: 'Chicken', qty: '200g', cost: 80 }, { name: 'Cream', qty: '50ml', cost: 20 }, { name: 'Spices', qty: '10g', cost: 20 }],
  },
  {
    id: '2', name: 'Dal Makhani', category: 'Main Course', yield: '1 portion', costPerPortion: 45,
    ingredients: [{ name: 'Black Dal', qty: '100g', cost: 25 }, { name: 'Butter', qty: '20g', cost: 20 }],
  },
  {
    id: '3', name: 'Naan', category: 'Bread', yield: '1 piece', costPerPortion: 12,
    ingredients: [{ name: 'Maida', qty: '80g', cost: 6 }, { name: 'Yeast', qty: '5g', cost: 3 }, { name: 'Butter', qty: '10g', cost: 3 }],
  },
]

const CATEGORIES = ['Main Course', 'Starter', 'Bread', 'Dessert', 'Beverage', 'Side Dish']
const CATEGORY_OPTIONS = CATEGORIES.map(c => ({ value: c, label: c }))
const UNIT_OPTIONS = ['g', 'kg', 'ml', 'L', 'piece', 'cup', 'tbsp', 'tsp'].map(u => ({ value: u, label: u }))

interface AddIngredient {
  name: string
  qty: string
  unit: string
  cost: string
}

interface AddForm {
  name: string
  category: string
  yieldQty: string
  yieldUnit: string
  ingredients: AddIngredient[]
}

const emptyIngredient = (): AddIngredient => ({ name: '', qty: '', unit: 'g', cost: '' })

export const RecipesPage: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>(MOCK_RECIPES)
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const [form, setForm] = useState<AddForm>({
    name: '', category: 'Main Course', yieldQty: '1', yieldUnit: 'portion',
    ingredients: [emptyIngredient()],
  })

  const addIngredient = () => setForm(p => ({ ...p, ingredients: [...p.ingredients, emptyIngredient()] }))
  const removeIngredient = (idx: number) => setForm(p => ({ ...p, ingredients: p.ingredients.filter((_, i) => i !== idx) }))
  const updateIngredient = (idx: number, field: keyof AddIngredient, val: string) =>
    setForm(p => ({ ...p, ingredients: p.ingredients.map((ing, i) => i === idx ? { ...ing, [field]: val } : ing) }))

  const handleAdd = () => {
    if (!form.name.trim()) { toast.error('Recipe name required'); return }
    const validIngredients = form.ingredients.filter(i => i.name.trim())
    const costPerPortion = validIngredients.reduce((s, i) => s + Number(i.cost || 0), 0)
    const newRecipe: Recipe = {
      id: String(Date.now()),
      name: form.name,
      category: form.category,
      yield: `${form.yieldQty} ${form.yieldUnit}`,
      costPerPortion,
      ingredients: validIngredients.map(i => ({ name: i.name, qty: `${i.qty}${i.unit}`, cost: Number(i.cost || 0) })),
    }
    setRecipes(p => [...p, newRecipe])
    toast.success('Recipe added successfully')
    setForm({ name: '', category: 'Main Course', yieldQty: '1', yieldUnit: 'portion', ingredients: [emptyIngredient()] })
    setShowAddModal(false)
  }

  const handleDelete = (id: string, name: string) => {
    setRecipes(p => p.filter(r => r.id !== id))
    toast.success(`${name} deleted`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recipes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{recipes.length} recipes in the kitchen</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
          Add Recipe
        </Button>
      </div>

      {/* Grid */}
      {recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <ChefHat className="w-12 h-12 mb-3" />
          <p className="text-lg font-medium">No recipes yet</p>
          <p className="text-sm">Add your first recipe to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map(recipe => (
            <div
              key={recipe.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{recipe.name}</h3>
                  <Badge variant="default" size="sm">{recipe.category}</Badge>
                </div>
                <button
                  onClick={() => handleDelete(recipe.id, recipe.name)}
                  className="text-gray-300 hover:text-red-500 transition-colors mt-0.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Yield: <span className="font-medium text-gray-900 dark:text-white">{recipe.yield}</span></span>
                <span>Cost: <span className="font-semibold text-green-600 dark:text-green-400">â‚¹{recipe.costPerPortion}</span></span>
              </div>

              <p className="text-xs text-gray-400">{recipe.ingredients.length} ingredients</p>

              <Button variant="outline" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => setViewRecipe(recipe)}>
                View Recipe
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* View Recipe Modal */}
      <Modal
        open={!!viewRecipe}
        onClose={() => setViewRecipe(null)}
        title={viewRecipe?.name ?? ''}
        size="md"
      >
        {viewRecipe && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>Category: <Badge variant="default">{viewRecipe.category}</Badge></span>
              <span>Yield: <strong className="text-gray-900 dark:text-white">{viewRecipe.yield}</strong></span>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ingredients</h4>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">Ingredient</th>
                      <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">Quantity</th>
                      <th className="text-right px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewRecipe.ingredients.map((ing, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{ing.name}</td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{ing.qty}</td>
                        <td className="px-4 py-2 text-right text-gray-800 dark:text-gray-200">â‚¹{ing.cost}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                      <td colSpan={2} className="px-4 py-2 font-semibold text-gray-900 dark:text-white">Cost per portion</td>
                      <td className="px-4 py-2 text-right font-bold text-green-600 dark:text-green-400">â‚¹{viewRecipe.costPerPortion}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Recipe Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Recipe"
        size="lg"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Save Recipe</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Recipe Name"
            placeholder="e.g. Butter Chicken"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
          />
          <div className="flex gap-3">
            <Input
              label="Yield Quantity"
              type="number"
              min="1"
              value={form.yieldQty}
              onChange={e => setForm(p => ({ ...p, yieldQty: e.target.value }))}
            />
            <Select
              label="Yield Unit"
              options={[
                { value: 'portion', label: 'portion' },
                { value: 'piece', label: 'piece' },
                { value: 'serving', label: 'serving' },
                { value: 'litre', label: 'litre' },
              ]}
              value={form.yieldUnit}
              onChange={e => setForm(p => ({ ...p, yieldUnit: e.target.value }))}
            />
          </div>

          {/* Dynamic ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ingredients</label>
              <button onClick={addIngredient} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {form.ingredients.map((ing, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Input
                      placeholder="Ingredient"
                      value={ing.name}
                      onChange={e => updateIngredient(idx, 'name', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="Qty"
                      value={ing.qty}
                      onChange={e => updateIngredient(idx, 'qty', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Select
                      options={UNIT_OPTIONS}
                      value={ing.unit}
                      onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="â‚¹ Cost"
                      type="number"
                      value={ing.cost}
                      onChange={e => updateIngredient(idx, 'cost', e.target.value)}
                    />
                  </div>
                  <div className="col-span-1 flex justify-center pb-2">
                    {form.ingredients.length > 1 && (
                      <button onClick={() => removeIngredient(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

