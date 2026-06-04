import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, ChefHat, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppSelector } from '@flowtap/store'
import { foodApi, inventoryApi, type Recipe, type RecipeIngredient } from '@flowtap/api-core'
import { Button, Modal, Spinner, Input, Select, Badge } from '@flowtap/ui-core'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  sku: string
  kind: string
}

interface IngredientRow {
  rawMaterialProductId: string
  rawMaterialName: string
  quantity: string
  unit: string
}

interface RecipeFormState {
  productId: string
  name: string
  yieldQuantity: string
  instructions: string
  ingredients: IngredientRow[]
}

const EMPTY_INGREDIENT: IngredientRow = { rawMaterialProductId: '', rawMaterialName: '', quantity: '', unit: 'grams' }

const UNITS = ['grams', 'kg', 'ml', 'litres', 'pcs', 'tsp', 'tbsp', 'cups', 'packets']

const EMPTY_FORM: RecipeFormState = {
  productId: '',
  name: '',
  yieldQuantity: '1',
  instructions: '',
  ingredients: [{ ...EMPTY_INGREDIENT }],
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FoodRecipePage: React.FC = () => {
  const tenant         = useAppSelector((s) => s.tenant.tenant)
  const currentStoreId = useAppSelector((s) => s.tenant.currentStoreId)

  const [recipes, setRecipes]         = useState<Recipe[]>([])
  const [menuItems, setMenuItems]     = useState<Product[]>([])
  const [rawMaterials, setRawMaterials] = useState<Product[]>([])
  const [loading, setLoading]         = useState(false)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<Recipe | null>(null)
  const [form, setForm]               = useState<RecipeFormState>(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  const companyId  = tenant?.id ?? ''
  const locationId = currentStoreId ?? ''

  const loadData = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [recipeRes, menuRes, rawRes] = await Promise.all([
        foodApi.getRecipes({ companyId, locationId }),
        inventoryApi.getProducts({ companyId, kind: 'FinalProduct', pageSize: 200 }),
        foodApi.getRawMaterials({ companyId, locationId }),
      ])
      // Recipes: { data: Recipe[] }
      setRecipes(recipeRes.data?.data ?? [])
      // getProducts paginated: { data: { items: [...] } }
      const menuData = menuRes.data?.data
      setMenuItems(menuData?.items ?? (Array.isArray(menuData) ? menuData : []))
      // getRawMaterials also paginated via /products
      const rawData = rawRes.data?.data
      setRawMaterials(rawData?.items ?? (Array.isArray(rawData) ? rawData : []))
    } catch {
      toast.error('Failed to load recipes')
    } finally {
      setLoading(false)
    }
  }, [companyId, locationId])

  useEffect(() => { loadData() }, [loadData])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (r: Recipe) => {
    setEditing(r)
    setForm({
      productId: r.productId,
      name: r.name,
      yieldQuantity: String(r.yieldQuantity),
      instructions: r.instructions ?? '',
      ingredients: r.ingredients.length > 0
        ? r.ingredients.map((i) => ({
            rawMaterialProductId: i.rawMaterialProductId,
            rawMaterialName: i.rawMaterialName,
            quantity: String(i.quantity),
            unit: i.unit,
          }))
        : [{ ...EMPTY_INGREDIENT }],
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recipe?')) return
    setDeletingId(id)
    try {
      await foodApi.deleteRecipe(id)
      toast.success('Recipe deleted')
      loadData()
    } catch {
      toast.error('Failed to delete recipe')
    } finally {
      setDeletingId(null)
    }
  }

  const updateIngredient = (idx: number, field: keyof IngredientRow, value: string) => {
    const updated = [...form.ingredients]
    updated[idx] = { ...updated[idx], [field]: value }

    // Auto-fill rawMaterialName from product selection
    if (field === 'rawMaterialProductId') {
      const product = rawMaterials.find((p) => p.id === value)
      if (product) updated[idx].rawMaterialName = product.name
    }

    setForm({ ...form, ingredients: updated })
  }

  const addIngredient = () => {
    setForm({ ...form, ingredients: [...form.ingredients, { ...EMPTY_INGREDIENT }] })
  }

  const removeIngredient = (idx: number) => {
    if (form.ingredients.length === 1) return
    setForm({ ...form, ingredients: form.ingredients.filter((_, i) => i !== idx) })
  }

  const handleSave = async () => {
    if (!form.productId) { toast.error('Select a menu item'); return }
    if (!form.name.trim()) { toast.error('Recipe name is required'); return }
    const validIngredients = form.ingredients.filter(
      (i) => i.rawMaterialProductId && i.quantity && parseFloat(i.quantity) > 0
    )
    if (validIngredients.length === 0) {
      toast.error('Add at least one ingredient with a quantity')
      return
    }

    setSaving(true)
    try {
      const payload = {
        productId: form.productId,
        name: form.name.trim(),
        yieldQuantity: parseInt(form.yieldQuantity) || 1,
        instructions: form.instructions.trim() || undefined,
        ingredients: validIngredients.map((i) => ({
          rawMaterialProductId: i.rawMaterialProductId,
          rawMaterialName: i.rawMaterialName,
          quantity: parseFloat(i.quantity),
          unit: i.unit,
        })),
      }

      if (editing) {
        await foodApi.updateRecipe(editing.id, payload)
        toast.success('Recipe updated')
      } else {
        await foodApi.createRecipe(payload)
        toast.success('Recipe created')
      }
      setModalOpen(false)
      loadData()
    } catch {
      toast.error('Failed to save recipe')
    } finally {
      setSaving(false)
    }
  }

  const menuItemName = (productId: string) =>
    menuItems.find((p) => p.id === productId)?.name ?? productId

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recipes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Map menu items to raw material ingredients
          </p>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Recipe
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No recipes yet. Add your first recipe to track ingredient usage.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{r.name}</h3>
                    <Badge variant="default" className="text-xs">
                      Yields {r.yieldQuantity} portion{r.yieldQuantity !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Menu item: {menuItemName(r.productId)}
                  </p>
                  {r.ingredients.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.ingredients.map((ing, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        >
                          {ing.rawMaterialName} {ing.quantity}{ing.unit}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.instructions && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic line-clamp-2">
                      {r.instructions}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(r)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                  >
                    {deletingId === r.id ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Recipe' : 'Add Recipe'}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Menu Item */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Menu Item *</label>
            <Select
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              options={[
                { value: '', label: 'Select menu item...' },
                ...menuItems.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>

          {/* Recipe Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipe Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Butter Chicken (Standard)"
            />
          </div>

          {/* Yield */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Yield (portions)</label>
            <Input
              type="number"
              value={form.yieldQuantity}
              onChange={(e) => setForm({ ...form, yieldQuantity: e.target.value })}
              min={1}
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instructions</label>
            <textarea
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="Step-by-step cooking instructions..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none
                         focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ingredients *</label>
              <button
                type="button"
                onClick={addIngredient}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Row
              </button>
            </div>
            <div className="space-y-2">
              {form.ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  {/* Raw material select */}
                  <div className="flex-1 min-w-0">
                    <Select
                      value={ing.rawMaterialProductId}
                      onChange={(e) => updateIngredient(idx, 'rawMaterialProductId', e.target.value)}
                      options={[
                        { value: '', label: 'Select ingredient...' },
                        ...rawMaterials.map((p) => ({ value: p.id, label: p.name })),
                      ]}
                    />
                  </div>
                  {/* Quantity */}
                  <div className="w-20 shrink-0">
                    <Input
                      type="number"
                      value={ing.quantity}
                      onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)}
                      placeholder="Qty"
                      min={0}
                    />
                  </div>
                  {/* Unit */}
                  <div className="w-24 shrink-0">
                    <Select
                      value={ing.unit}
                      onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                      options={UNITS.map((u) => ({ value: u, label: u }))}
                    />
                  </div>
                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    disabled={form.ingredients.length === 1}
                    className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : editing ? 'Update Recipe' : 'Create Recipe'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
