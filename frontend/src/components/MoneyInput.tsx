import { InputNumber } from 'antd';
import type { InputNumberProps } from 'antd';

function groupThousands(value: string): string {
  const [intPart, fracPart] = value.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fracPart !== undefined ? `${grouped}.${fracPart}` : grouped;
}

export function MoneyInput(props: InputNumberProps<number>) {
  return (
    <InputNumber<number>
      formatter={(value) =>
        value === undefined || value === null ? '' : groupThousands(String(value))
      }
      parser={(displayValue) => (displayValue ?? '').replace(/\s/g, '') as unknown as number}
      {...props}
    />
  );
}
