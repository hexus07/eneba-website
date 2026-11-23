<?php

namespace App\Http\Requests;

use App\Services\Catalog\ProductFilter;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Accept both `platform[]=steam&platform[]=psn` and `platform=steam,psn` (same for region, genre, type). */
    protected function prepareForValidation(): void
    {
        foreach (['platform', 'region', 'genre', 'type'] as $key) {
            $value = $this->input($key);
            if (is_string($value)) {
                $this->merge([$key => array_values(array_filter(array_map('trim', explode(',', $value))))]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:'.config('search.max_query_length')],
            'platform' => ['nullable', 'array', 'max:20'],
            'platform.*' => ['string', 'max:64'],
            'region' => ['nullable', 'array', 'max:20'],
            'region.*' => ['string', 'max:64'],
            'genre' => ['nullable', 'array', 'max:20'],
            'genre.*' => ['string', 'max:64'],
            'type' => ['nullable', 'array', 'max:5'],
            'type.*' => ['string', Rule::in(ProductFilter::TYPES)],
            'price_min' => ['nullable', 'integer', 'min:0'],
            'price_max' => ['nullable', 'integer', 'min:0', ...($this->filled('price_min') ? ['gte:price_min'] : [])],
            'sort' => ['nullable', Rule::in(ProductFilter::SORTS)],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:48'],
        ];
    }

    public function filters(): array
    {
        $data = $this->validated();

        foreach (['price_min', 'price_max', 'page', 'per_page'] as $int) {
            if (isset($data[$int])) {
                $data[$int] = (int) $data[$int];
            }
        }

        return $data;
    }
}
