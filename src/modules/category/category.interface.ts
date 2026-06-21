export interface ICategory {
  name: string;
  image: {
    public_id: string;
    url: string;
  };
  totalProduct: number;
  isDeleted: boolean;
}
